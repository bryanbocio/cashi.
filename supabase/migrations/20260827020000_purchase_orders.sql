-- S5.1 · Órdenes de compra.
-- Las órdenes se editan mientras están pendientes. Recibirlas es una operación
-- de negocio atómica: actualiza costo y stock, deja movimientos y cambia el
-- estado una sola vez, incluso si llegan solicitudes simultáneas.

create index if not exists purchase_order_business_status_created_idx
  on public.purchase_order (business_id, status, created_at desc);

-- Sustituye las políticas generales por el ciclo de vida de una compra.
drop policy if exists "insert own business" on public.purchase_order;
drop policy if exists "update own business" on public.purchase_order;
drop policy if exists "delete own business" on public.purchase_order;

create policy "insert pending purchase order"
on public.purchase_order for insert to authenticated
with check (
  public.is_member(business_id)
  and status = 'PENDING'
  and received_at is null
  and (
    purchase_order.supplier_id is null
    or exists (
      select 1
      from public.supplier s
      where s.id = purchase_order.supplier_id
        and s.business_id = purchase_order.business_id
    )
  )
);

create policy "update pending purchase order"
on public.purchase_order for update to authenticated
using (public.is_member(business_id) and status = 'PENDING')
with check (
  public.is_member(business_id)
  and status in ('PENDING', 'CANCELLED')
  and received_at is null
  and (
    purchase_order.supplier_id is null
    or exists (
      select 1
      from public.supplier s
      where s.id = purchase_order.supplier_id
        and s.business_id = purchase_order.business_id
    )
  )
);

create policy "delete unreceived purchase order"
on public.purchase_order for delete to authenticated
using (public.is_member(business_id) and status in ('PENDING', 'CANCELLED'));

-- El cliente solo puede editar los campos propios del borrador. El código,
-- negocio y sello de recepción quedan bajo control del servidor.
revoke update on public.purchase_order from authenticated;
grant update (supplier_id, status, expected_at) on public.purchase_order to authenticated;

drop policy if exists "purchase line insert own business" on public.purchase_line;
drop policy if exists "purchase line update own business" on public.purchase_line;
drop policy if exists "purchase line delete own business" on public.purchase_line;

create policy "purchase line insert pending order"
on public.purchase_line for insert to authenticated
with check (
  exists (
    select 1
    from public.purchase_order po
    join public.product p on p.id = purchase_line.product_id and p.business_id = po.business_id
    where po.id = purchase_line.purchase_order_id
      and po.status = 'PENDING'
      and public.is_member(po.business_id)
  )
);

create policy "purchase line update pending order"
on public.purchase_line for update to authenticated
using (
  exists (
    select 1 from public.purchase_order po
    where po.id = purchase_line.purchase_order_id
      and po.status = 'PENDING'
      and public.is_member(po.business_id)
  )
)
with check (
  exists (
    select 1
    from public.purchase_order po
    join public.product p on p.id = purchase_line.product_id and p.business_id = po.business_id
    where po.id = purchase_line.purchase_order_id
      and po.status = 'PENDING'
      and public.is_member(po.business_id)
  )
);

create policy "purchase line delete pending order"
on public.purchase_line for delete to authenticated
using (
  exists (
    select 1 from public.purchase_order po
    where po.id = purchase_line.purchase_order_id
      and po.status = 'PENDING'
      and public.is_member(po.business_id)
  )
);

create or replace function public.receive_purchase_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
  v_status public.purchase_status;
  v_line record;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para recibir una orden de compra.';
  end if;

  -- Serializa cualquier intento de recibir la misma orden. La segunda llamada
  -- espera y luego encuentra RECEIVED, por lo que sale sin repetir efectos.
  select business_id, status
  into v_business, v_status
  from public.purchase_order
  where id = p_order
  for update;

  if v_business is null then
    raise exception using
      errcode = 'P0002',
      message = 'La orden de compra no existe.';
  end if;

  if not public.is_member(v_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  if v_status = 'RECEIVED' then
    return;
  end if;

  if v_status = 'CANCELLED' then
    raise exception using
      errcode = '22023',
      message = 'Una orden cancelada no se puede recibir.';
  end if;

  if not exists (
    select 1 from public.purchase_line where purchase_order_id = p_order
  ) then
    raise exception using
      errcode = '22023',
      message = 'La orden necesita al menos un producto.';
  end if;

  if exists (
    select 1
    from public.purchase_line l
    join public.product p on p.id = l.product_id
    where l.purchase_order_id = p_order
      and p.business_id <> v_business
  ) then
    raise exception using
      errcode = '42501',
      message = 'La orden contiene un producto de otro negocio.';
  end if;

  -- Bloqueo determinista, igual que en create_sale y void_sale, para evitar
  -- deadlocks cuando dos órdenes distintas comparten productos.
  for v_line in
    select l.product_id, sum(l.qty)::integer as qty, max(l.unit_cost)::bigint as unit_cost
    from public.purchase_line l
    where l.purchase_order_id = p_order
    group by l.product_id
    order by l.product_id
  loop
    update public.product
    set stock = stock + v_line.qty,
        cost = v_line.unit_cost
    where id = v_line.product_id;

    insert into public.stock_movement (
      business_id, product_id, type, qty_delta, ref_table, ref_id
    ) values (
      v_business, v_line.product_id, 'PURCHASE', v_line.qty, 'purchase_order', p_order
    );
  end loop;

  update public.purchase_order
  set status = 'RECEIVED', received_at = current_timestamp
  where id = p_order;
end;
$$;

comment on function public.receive_purchase_order(uuid) is
  'Recibe una orden pendiente: suma stock, actualiza el costo actual, escribe movimientos PURCHASE y marca RECEIVED. Es idempotente y segura ante concurrencia.';

revoke all on function public.receive_purchase_order(uuid) from public, anon;
grant execute on function public.receive_purchase_order(uuid) to authenticated;
