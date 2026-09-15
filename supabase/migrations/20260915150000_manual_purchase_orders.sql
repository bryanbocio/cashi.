-- Permite registrar compras reales desde la interfaz, sin depender de la
-- sugerencia automática de reposición. La creación de cabecera y líneas es
-- atómica; opcionalmente se recibe en la misma transacción.

create or replace function public.create_purchase_order(
  p_business uuid,
  p_supplier uuid,
  p_expected date,
  p_receive boolean,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid;
  v_code text;
  v_total numeric;
  v_total_units bigint;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para registrar una compra.';
  end if;

  if not public.is_member(p_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  if p_supplier is not null and not exists (
    select 1 from public.supplier s
    where s.id = p_supplier and s.business_id = p_business
  ) then
    raise exception using
      errcode = '22023',
      message = 'El proveedor no pertenece a este negocio.';
  end if;

  if p_lines is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) = 0
  then
    raise exception using
      errcode = '22023',
      message = 'Agrega al menos un producto a la compra.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) line
    where jsonb_typeof(line) <> 'object'
      or coalesce(line ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(line ->> 'qty', '') !~ '^[0-9]+$'
      or coalesce(line ->> 'unit_cost', '') !~ '^[0-9]+$'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Revisa el producto, la cantidad y el costo de cada línea.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(product_id text, qty numeric, unit_cost numeric)
    where line.qty < 1
      or line.qty > 2147483647
      or line.qty <> trunc(line.qty)
      or line.unit_cost < 0
      or line.unit_cost > 9223372036854775807
      or line.unit_cost <> trunc(line.unit_cost)
  ) then
    raise exception using
      errcode = '22023',
      message = 'La cantidad debe ser mayor que cero y el costo no puede ser negativo.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(product_id text, qty numeric, unit_cost numeric)
    group by line.product_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'No repitas un producto dentro de la misma compra.';
  end if;

  if (
    select count(*)
    from jsonb_to_recordset(p_lines) as line(product_id text, qty numeric, unit_cost numeric)
    join public.product p on p.id = line.product_id::uuid
    where p.business_id = p_business and p.active
  ) <> jsonb_array_length(p_lines) then
    raise exception using
      errcode = '22023',
      message = 'La compra contiene un producto inexistente o inactivo.';
  end if;

  select sum(line.qty), sum(line.qty * line.unit_cost)
  into v_total_units, v_total
  from jsonb_to_recordset(p_lines) as line(product_id text, qty bigint, unit_cost numeric);

  if v_total > 9223372036854775807 then
    raise exception using
      errcode = '22003',
      message = 'El total de la compra supera el máximo permitido.';
  end if;

  -- Mantiene el mismo orden de bloqueo que ventas y recepción de compras.
  perform p.id
  from public.product p
  join jsonb_to_recordset(p_lines) as line(product_id text, qty bigint, unit_cost bigint)
    on p.id = line.product_id::uuid
  order by p.id
  for update;

  v_code := public.next_doc_code(p_business, 'PURCHASE');

  insert into public.purchase_order (business_id, code, supplier_id, expected_at)
  values (p_business, v_code, p_supplier, p_expected)
  returning id into v_order;

  insert into public.purchase_line (purchase_order_id, product_id, qty, unit_cost)
  select v_order, line.product_id::uuid, line.qty::integer, line.unit_cost::bigint
  from jsonb_to_recordset(p_lines) as line(product_id text, qty numeric, unit_cost numeric);

  if coalesce(p_receive, false) then
    perform public.receive_purchase_order(v_order);
  end if;

  return jsonb_build_object(
    'id', v_order,
    'business_id', p_business,
    'code', v_code,
    'status', case when coalesce(p_receive, false) then 'RECEIVED' else 'PENDING' end,
    'product_count', jsonb_array_length(p_lines),
    'total_units', v_total_units,
    'total_cost', v_total::bigint
  );
end;
$$;

comment on function public.create_purchase_order(uuid, uuid, date, boolean, jsonb) is
  'Crea atómicamente una compra manual y, si se solicita, la recibe para actualizar existencias y costos.';

revoke all on function public.create_purchase_order(uuid, uuid, date, boolean, jsonb) from public, anon;
grant execute on function public.create_purchase_order(uuid, uuid, date, boolean, jsonb) to authenticated;
