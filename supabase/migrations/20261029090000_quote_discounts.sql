-- Los descuentos de una cotización se congelan junto con sus precios y se
-- conservan al convertirla en venta.

alter table public.quote
  add column discount bigint not null default 0 check (discount >= 0);

alter table public.quote
  add constraint quote_discount_not_above_subtotal
  check (discount <= total + discount);

create or replace function public.create_quote(
  p_business uuid,
  p_customer uuid,
  p_lines jsonb,
  p_valid_until date,
  p_discount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discount bigint := coalesce(p_discount, 0);
  v_result jsonb;
  v_quote uuid;
  v_subtotal bigint;
  v_total bigint;
  v_gross_profit bigint;
begin
  if v_discount < 0 then
    raise exception using
      errcode = '22023',
      message = 'El descuento no puede ser negativo.';
  end if;

  -- La función original sigue siendo la fuente única para validar productos,
  -- congelar precios/costos y generar el código. Esta sobrecarga solo añade el
  -- descuento de forma atómica dentro de la misma transacción.
  v_result := public.create_quote(p_business, p_customer, p_lines, p_valid_until);
  v_quote := (v_result ->> 'id')::uuid;
  v_subtotal := (v_result ->> 'total')::bigint;

  if v_discount > v_subtotal then
    raise exception using
      errcode = '22023',
      message = 'El descuento no puede superar el total de la cotización.';
  end if;

  v_total := v_subtotal - v_discount;

  select coalesce(sum(ql.qty * (ql.unit_price - ql.unit_cost)), 0)::bigint - v_discount
  into v_gross_profit
  from public.quote_line ql
  where ql.quote_id = v_quote;

  update public.quote
  set discount = v_discount,
      total = v_total
  where id = v_quote;

  return v_result || jsonb_build_object(
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total', v_total,
    'gross_profit', v_gross_profit
  );
end;
$$;

comment on function public.create_quote(uuid, uuid, jsonb, date, bigint) is
  'Crea una cotización con descuento, congela sus precios y costos y no altera el inventario.';

revoke all on function public.create_quote(uuid, uuid, jsonb, date, bigint) from public, anon;
grant execute on function public.create_quote(uuid, uuid, jsonb, date, bigint) to authenticated;

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
  coalesce(l.gross_profit, 0) - q.discount as gross_profit,
  coalesce(l.detail, '') as detail,
  q.discount,
  (q.total + q.discount)::bigint as subtotal
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
  'Listado de cotizaciones con cliente, subtotal, descuento, total, ganancia congelada y resumen de líneas. Hereda RLS mediante security_invoker.';

revoke all on public.v_quote_detail from public, anon;
grant select on public.v_quote_detail to authenticated;

create or replace function public.convert_quote(
  p_quote uuid,
  p_method text,
  p_due date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
  v_customer uuid;
  v_quote_code text;
  v_quote_status public.quote_status;
  v_discount bigint;
  v_method public.payment_method;
  v_lines jsonb;
  v_sale uuid;
  v_result jsonb;
begin
  if v_user is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para convertir una cotización.';
  end if;

  select q.business_id, q.customer_id, q.code, q.status, q.discount
  into v_business, v_customer, v_quote_code, v_quote_status, v_discount
  from public.quote q
  where q.id = p_quote
  for update;

  if v_business is null then
    raise exception using errcode = 'P0002', message = 'La cotización no existe.';
  end if;

  if not public.is_member(v_business) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este negocio.';
  end if;

  if v_quote_status = 'CONVERTED' then
    select s.id into v_sale
    from public.sale s
    where s.quote_id = p_quote;

    if v_sale is null then
      raise exception using
        errcode = 'P0002',
        message = 'La cotización figura convertida, pero su venta no existe.';
    end if;
  elsif v_quote_status <> 'OPEN' then
    raise exception using
      errcode = '22023',
      message = 'Solo una cotización abierta se puede convertir.';
  else
    begin
      v_method := upper(trim(coalesce(p_method, '')))::public.payment_method;
    exception
      when invalid_text_representation then
        raise exception using errcode = '22023', message = 'El método de pago no es válido.';
    end;

    if v_method = 'CREDIT' and v_customer is null then
      raise exception using
        errcode = '22023',
        message = 'Una cotización a crédito necesita un cliente.';
    end if;

    if not exists (select 1 from public.quote_line ql where ql.quote_id = p_quote) then
      raise exception using
        errcode = '22023',
        message = 'La cotización necesita al menos un producto.';
    end if;

    if exists (
      select 1 from public.quote_line ql
      where ql.quote_id = p_quote and ql.product_id is null
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'Algún producto de la cotización ya no existe.';
    end if;

    select jsonb_agg(
      jsonb_build_object('product_id', ql.product_id, 'qty', ql.qty)
      order by ql.product_id
    )
    into v_lines
    from public.quote_line ql
    where ql.quote_id = p_quote;

    v_result := public.create_sale(
      v_business,
      v_customer,
      v_method::text,
      v_discount,
      p_due,
      v_lines
    );
    v_sale := (v_result ->> 'id')::uuid;

    update public.sale set quote_id = p_quote where id = v_sale;
    update public.quote set status = 'CONVERTED' where id = p_quote;
  end if;

  select jsonb_build_object(
    'id', s.id,
    'code', s.code,
    'business_id', s.business_id,
    'customer_id', s.customer_id,
    'payment_method', s.payment_method,
    'status', s.status,
    'subtotal', s.total + s.discount,
    'discount', s.discount,
    'total', s.total,
    'gross_profit', coalesce(l.gross_profit, 0) - s.discount,
    'due_date', s.due_date,
    'sold_at', s.sold_at,
    'quote_id', p_quote,
    'quote_code', v_quote_code,
    'lines', coalesce(l.lines, '[]'::jsonb)
  )
  into v_result
  from public.sale s
  left join lateral (
    select
      sum(sl.qty * (sl.unit_price - sl.unit_cost))::bigint as gross_profit,
      jsonb_agg(jsonb_build_object(
        'product_id', sl.product_id,
        'name', sl.name_snapshot,
        'category', sl.category_snapshot,
        'qty', sl.qty,
        'unit_price', sl.unit_price,
        'unit_cost', sl.unit_cost,
        'line_total', sl.qty * sl.unit_price,
        'line_profit', sl.qty * (sl.unit_price - sl.unit_cost)
      ) order by sl.name_snapshot, sl.id) as lines
    from public.sale_line sl
    where sl.sale_id = s.id
  ) l on true
  where s.id = v_sale;

  return v_result;
end;
$$;

comment on function public.convert_quote(uuid, text, date) is
  'Convierte una cotización conservando su descuento y enlaza la venta de forma idempotente.';

revoke all on function public.convert_quote(uuid, text, date) from public, anon;
grant execute on function public.convert_quote(uuid, text, date) to authenticated;
