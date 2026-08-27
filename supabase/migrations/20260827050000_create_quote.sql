-- S6.1 · Cotizaciones y listados.
-- Una cotización congela el nombre, precio y costo actuales, pero no descuenta
-- stock ni escribe movimientos. Las vistas entregan el resumen para la lista y
-- las líneas calculadas que más adelante consumirá el visor de documentos.

create or replace function public.create_quote(
  p_business uuid,
  p_customer uuid,
  p_lines jsonb,
  p_valid_until date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_lines jsonb;
  v_expected integer;
  v_matched integer;
  v_total_numeric numeric;
  v_cost_numeric numeric;
  v_total bigint;
  v_quote uuid;
  v_code text;
  v_result jsonb;
begin
  if v_user is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para crear una cotización.';
  end if;

  if not public.is_member(p_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  if p_valid_until is null then
    raise exception using
      errcode = '22023',
      message = 'La cotización necesita una fecha de vigencia.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using
      errcode = '22023',
      message = 'La cotización necesita al menos un producto.';
  end if;

  -- Un producto aparece una sola vez en el documento. Se usa numeric durante
  -- la suma para detectar cantidades fuera del rango de integer con un mensaje
  -- estable, en vez de depender de un error de cast de PostgreSQL.
  begin
    if exists (
      select 1
      from jsonb_array_elements(p_lines) as entry(value)
      where (entry.value ->> 'product_id')::uuid is null
         or (entry.value ->> 'qty')::numeric is null
         or (entry.value ->> 'qty')::numeric <> trunc((entry.value ->> 'qty')::numeric)
         or (entry.value ->> 'qty')::numeric <= 0
         or (entry.value ->> 'qty')::numeric > 2147483647
    ) then
      raise exception using
        errcode = '22023',
        message = 'Cada línea debe llevar una cantidad entera mayor que cero.';
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object('product_id', product_id, 'qty', qty)
        order by product_id
      ),
      '[]'::jsonb
    )
    into v_lines
    from (
      select
        (entry.value ->> 'product_id')::uuid as product_id,
        sum((entry.value ->> 'qty')::numeric) as qty
      from jsonb_array_elements(p_lines) as entry(value)
      group by 1
    ) grouped;
  exception
    when invalid_text_representation or null_value_not_allowed or numeric_value_out_of_range then
      raise exception using
        errcode = '22023',
        message = 'Alguna línea de la cotización no tiene un producto o una cantidad válidos.';
  end;

  if exists (
    select 1
    from jsonb_to_recordset(v_lines) as x(product_id uuid, qty numeric)
    where x.product_id is null
       or x.qty is null
       or x.qty <> trunc(x.qty)
       or x.qty <= 0
       or x.qty > 2147483647
  ) then
    raise exception using
      errcode = '22023',
      message = 'Cada línea debe llevar una cantidad entera mayor que cero.';
  end if;

  v_expected := jsonb_array_length(v_lines);

  if p_customer is not null then
    perform c.id
    from public.customer c
    where c.id = p_customer
      and c.business_id = p_business
    for key share of c;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'El cliente no existe en este negocio.';
    end if;
  end if;

  -- Conserva una fotografía coherente si otro proceso edita precio o costo al
  -- mismo tiempo. El orden UUID coincide con las demás RPC multiproducto.
  perform p.id
  from jsonb_to_recordset(v_lines) as x(product_id uuid, qty numeric)
  join public.product p on p.id = x.product_id
  where p.business_id = p_business
    and p.active
  order by p.id
  for share of p;

  select count(*)
  into v_matched
  from jsonb_to_recordset(v_lines) as x(product_id uuid, qty numeric)
  join public.product p on p.id = x.product_id
  where p.business_id = p_business
    and p.active;

  if v_matched <> v_expected then
    raise exception using
      errcode = 'P0002',
      message = 'Algún producto de la cotización no existe o no está disponible en este negocio.';
  end if;

  select
    sum(x.qty * p.price::numeric),
    sum(x.qty * p.cost::numeric)
  into v_total_numeric, v_cost_numeric
  from jsonb_to_recordset(v_lines) as x(product_id uuid, qty numeric)
  join public.product p on p.id = x.product_id;

  if v_total_numeric > 9223372036854775807 or v_cost_numeric > 9223372036854775807 then
    raise exception using
      errcode = '22003',
      message = 'Los montos de la cotización superan el límite permitido.';
  end if;

  v_total := v_total_numeric::bigint;
  v_code := public.next_doc_code(p_business, 'QUOTE');

  insert into public.quote (
    business_id, code, customer_id, valid_until, status, total
  ) values (
    p_business, v_code, p_customer, p_valid_until, 'OPEN', v_total
  )
  returning id into v_quote;

  insert into public.quote_line (
    quote_id, product_id, name_snapshot, qty, unit_price, unit_cost
  )
  select
    v_quote,
    p.id,
    p.name,
    x.qty::integer,
    p.price,
    p.cost
  from jsonb_to_recordset(v_lines) as x(product_id uuid, qty numeric)
  join public.product p on p.id = x.product_id
  order by p.id;

  select jsonb_build_object(
    'id', q.id,
    'business_id', q.business_id,
    'code', q.code,
    'customer_id', q.customer_id,
    'customer_name', c.name,
    'valid_until', q.valid_until,
    'status', q.status,
    'total', q.total,
    'created_at', q.created_at,
    'lines', (
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'product_id', l.product_id,
        'name', l.name_snapshot,
        'qty', l.qty,
        'unit_price', l.unit_price,
        'unit_cost', l.unit_cost,
        'line_total', l.qty * l.unit_price,
        'line_profit', l.qty * (l.unit_price - l.unit_cost)
      ) order by l.name_snapshot, l.id)
      from public.quote_line l
      where l.quote_id = q.id
    )
  )
  into v_result
  from public.quote q
  left join public.customer c on c.id = q.customer_id
  where q.id = v_quote;

  return v_result;
end;
$$;

comment on function public.create_quote(uuid, uuid, jsonb, date) is
  'Crea una cotización OPEN con código COT-, agrupa productos repetidos y congela nombre, precio y costo sin alterar stock.';

revoke all on function public.create_quote(uuid, uuid, jsonb, date) from public, anon;
grant execute on function public.create_quote(uuid, uuid, jsonb, date) to authenticated;

-- La creación y edición estructural pasan por funciones de negocio para que
-- total y snapshots no puedan divergir. El borrado de una cotización abierta
-- queda disponible para la acción Eliminar prevista en F6.1.
drop policy if exists "insert own business" on public.quote;
drop policy if exists "update own business" on public.quote;
drop policy if exists "delete own business" on public.quote;

create policy "delete open quote"
on public.quote for delete to authenticated
using (public.is_member(business_id) and status = 'OPEN');

revoke insert, update on public.quote from authenticated;
revoke insert, update, delete on public.quote_line from authenticated;

create or replace view public.v_quote_detail
with (security_invoker = true) as
select
  q.id,
  q.business_id,
  q.code,
  q.customer_id,
  coalesce(c.name, 'Sin cliente') as customer_name,
  c.phone as customer_phone,
  q.valid_until,
  q.status,
  q.total,
  q.created_at,
  q.updated_at,
  coalesce(l.line_count, 0) as line_count,
  coalesce(l.total_units, 0) as total_units,
  coalesce(l.gross_profit, 0) as gross_profit,
  coalesce(l.detail, '') as detail
from public.quote q
left join public.customer c on c.id = q.customer_id
left join lateral (
  select
    count(*)::integer as line_count,
    sum(ql.qty)::bigint as total_units,
    sum(ql.qty * (ql.unit_price - ql.unit_cost))::bigint as gross_profit,
    string_agg(ql.qty::text || '× ' || ql.name_snapshot, ', ' order by ql.name_snapshot, ql.id) as detail
  from public.quote_line ql
  where ql.quote_id = q.id
) l on true;

comment on view public.v_quote_detail is
  'Listado de cotizaciones con cliente, vigencia, totales, ganancia congelada y resumen de líneas. Hereda RLS mediante security_invoker.';

revoke all on public.v_quote_detail from public, anon;
grant select on public.v_quote_detail to authenticated;

create or replace view public.v_quote_line_detail
with (security_invoker = true) as
select
  q.business_id,
  q.id as quote_id,
  q.code,
  q.customer_id,
  q.valid_until,
  q.status,
  l.id as line_id,
  l.product_id,
  l.name_snapshot,
  l.qty,
  l.unit_price,
  l.unit_cost,
  (l.qty * l.unit_price)::bigint as line_total,
  (l.qty * (l.unit_price - l.unit_cost))::bigint as line_profit,
  l.created_at
from public.quote q
join public.quote_line l on l.quote_id = q.id;

comment on view public.v_quote_line_detail is
  'Líneas congeladas de cotización con importes calculados para detalle y documentos. Hereda RLS mediante security_invoker.';

revoke all on public.v_quote_line_detail from public, anon;
grant select on public.v_quote_line_detail to authenticated;
