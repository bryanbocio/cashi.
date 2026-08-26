-- S3.2 · Anulación de ventas y detalle de venta.
-- Anular devuelve el stock y escribe movimientos RETURN. La operación es
-- idempotente: anular dos veces no puede devolver el stock dos veces, ni
-- siquiera si las dos llamadas llegan a la vez.

create or replace function public.void_sale(p_sale uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
  v_status public.sale_status;
  v_line record;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión para anular una venta.';
  end if;

  -- `for update` serializa dos anulaciones simultáneas de la misma venta: la
  -- segunda espera y encuentra el estado ya cambiado.
  select business_id, status
  into v_business, v_status
  from public.sale
  where id = p_sale
  for update;

  if v_business is null then
    raise exception using errcode = 'P0002', message = 'La venta no existe.';
  end if;

  if not public.is_member(v_business) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este negocio.';
  end if;

  if v_status = 'VOID' then
    return;
  end if;

  update public.sale set status = 'VOID' where id = p_sale;

  -- Mismo orden de bloqueo que `create_sale`: por id de producto. Las líneas
  -- cuyo producto ya no existe no devuelven stock a ningún lado.
  for v_line in
    select l.product_id, sum(l.qty)::integer as qty
    from public.sale_line l
    where l.sale_id = p_sale and l.product_id is not null
    group by l.product_id
    order by l.product_id
  loop
    update public.product
    set stock = stock + v_line.qty
    where id = v_line.product_id;

    insert into public.stock_movement (business_id, product_id, type, qty_delta, ref_table, ref_id)
    values (v_business, v_line.product_id, 'RETURN', v_line.qty, 'sale', p_sale);
  end loop;
end;
$$;

comment on function public.void_sale(uuid) is
  'Anula una venta: la marca VOID, devuelve el stock y escribe movimientos RETURN. Idempotente incluso ante llamadas simultáneas.';

revoke all on function public.void_sale(uuid) from public;
grant execute on function public.void_sale(uuid) to authenticated;

-- Detalle de venta para listados e historial. Como toda vista del proyecto usa
-- `security_invoker` para heredar la RLS y necesita su propio grant.
create or replace view public.v_sale_detail
with (security_invoker = true) as
select
  s.id,
  s.business_id,
  s.code,
  s.customer_id,
  c.name as customer_name,
  s.payment_method,
  s.status,
  s.discount,
  s.total,
  s.due_date,
  s.sold_at,
  s.created_by,
  coalesce(l.subtotal, 0) as subtotal,
  -- El descuento sale del bolsillo del negocio, así que baja la ganancia.
  coalesce(l.gross_profit, 0) - s.discount as gross_profit,
  coalesce(l.line_count, 0) as line_count,
  coalesce(l.items, 0) as items
from public.sale s
left join public.customer c on c.id = s.customer_id
left join lateral (
  -- `sum` devuelve numeric; los montos del proyecto son bigint enteros.
  select
    sum(sl.qty * sl.unit_price)::bigint as subtotal,
    sum(sl.qty * (sl.unit_price - sl.unit_cost))::bigint as gross_profit,
    count(*)::integer as line_count,
    sum(sl.qty)::integer as items
  from public.sale_line sl
  where sl.sale_id = s.id
) l on true;

comment on view public.v_sale_detail is
  'Venta con su ganancia, el nombre del cliente y el resumen de líneas. Incluye las anuladas: filtra por status = CONFIRMED para cualquier cálculo de dinero.';
comment on column public.v_sale_detail.gross_profit is
  'Ganancia bruta de la venta: suma de qty × (unit_price − unit_cost) de sus líneas, menos el descuento.';

revoke all on public.v_sale_detail from anon;
grant select on public.v_sale_detail to authenticated;
