-- F5.1 · Contratos de lectura y creación atómica para la vista Compras.

create or replace view public.v_purchase_orders
with (security_invoker = true) as
select
  po.id,
  po.business_id,
  po.code,
  po.supplier_id,
  case
    when po.supplier_id is not null then s.name
    when coalesce(lines.line_count, 0) > 0 then 'Varios proveedores'
    else 'Sin proveedor'
  end as supplier_name,
  po.status,
  po.expected_at,
  po.received_at,
  po.created_at,
  coalesce(lines.line_count, 0) as line_count,
  coalesce(lines.total_units, 0) as total_units,
  coalesce(lines.total_cost, 0) as total_cost
from public.purchase_order po
left join public.supplier s on s.id = po.supplier_id
left join lateral (
  select
    count(*)::integer as line_count,
    sum(pl.qty)::bigint as total_units,
    sum(pl.qty * pl.unit_cost)::bigint as total_cost
  from public.purchase_line pl
  where pl.purchase_order_id = po.id
) lines on true;

comment on view public.v_purchase_orders is
  'Órdenes de compra con proveedor visible, cantidad de líneas, unidades y costo total. Las órdenes sugeridas sin proveedor único muestran Varios proveedores.';

revoke all on public.v_purchase_orders from anon;
grant select on public.v_purchase_orders to authenticated;

create or replace function public.create_suggested_purchase_order(p_business uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggestion jsonb;
  v_order uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para crear una orden de compra.';
  end if;

  if not public.is_member(p_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  -- Congela los productos sugeridos durante la creación. El orden por UUID es
  -- el mismo usado por ventas y recepción para mantener un orden de bloqueo.
  perform p.id
  from public.product p
  where p.business_id = p_business
    and p.active
    and p.stock < p.min_stock
  order by p.id
  for update;

  v_suggestion := public.suggest_purchase(p_business);

  if coalesce((v_suggestion ->> 'product_count')::integer, 0) = 0 then
    raise exception using
      errcode = '22023',
      message = 'No hay productos por reponer.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_suggestion -> 'lines') as line(suggested_qty bigint)
    where line.suggested_qty > 2147483647
  ) then
    raise exception using
      errcode = '22003',
      message = 'La cantidad sugerida supera el máximo permitido.';
  end if;

  v_code := public.next_doc_code(p_business, 'PURCHASE');

  insert into public.purchase_order (business_id, code, supplier_id)
  values (p_business, v_code, null)
  returning id into v_order;

  insert into public.purchase_line (
    purchase_order_id, product_id, qty, unit_cost
  )
  select
    v_order,
    line.product_id,
    line.suggested_qty::integer,
    line.unit_cost
  from jsonb_to_recordset(v_suggestion -> 'lines') as line(
    product_id uuid,
    suggested_qty bigint,
    unit_cost bigint
  );

  return jsonb_build_object(
    'id', v_order,
    'business_id', p_business,
    'code', v_code,
    'status', 'PENDING',
    'product_count', (v_suggestion ->> 'product_count')::integer,
    'total_units', (v_suggestion ->> 'total_units')::bigint,
    'estimated_total', (v_suggestion ->> 'estimated_total')::bigint
  );
end;
$$;

comment on function public.create_suggested_purchase_order(uuid) is
  'Crea en una transacción una orden PENDING con todas las líneas de suggest_purchase y código OC-. No modifica existencias ni costos.';

revoke all on function public.create_suggested_purchase_order(uuid) from public, anon;
grant execute on function public.create_suggested_purchase_order(uuid) to authenticated;
