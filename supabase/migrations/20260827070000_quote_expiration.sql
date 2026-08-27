-- F6.1 · Vigencia efectiva de cotizaciones.
-- OPEN sigue siendo el estado persistido para conservar un único origen de
-- verdad. Las vistas presentan EXPIRED cuando pasó la fecha local del negocio,
-- y el enlace de una venta valida esa misma regla dentro de la transacción.

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
  case
    when q.status = 'OPEN'
      and q.valid_until < (current_timestamp at time zone b.timezone)::date
      then 'EXPIRED'::public.quote_status
    else q.status
  end as status,
  q.total,
  q.created_at,
  q.updated_at,
  coalesce(l.line_count, 0) as line_count,
  coalesce(l.total_units, 0) as total_units,
  coalesce(l.gross_profit, 0) as gross_profit,
  coalesce(l.detail, '') as detail
from public.quote q
join public.business b on b.id = q.business_id
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
  'Listado de cotizaciones; deriva EXPIRED cuando valid_until ya pasó en la zona horaria del negocio. Hereda RLS mediante security_invoker.';

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
  case
    when q.status = 'OPEN'
      and q.valid_until < (current_timestamp at time zone b.timezone)::date
      then 'EXPIRED'::public.quote_status
    else q.status
  end as status,
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
join public.business b on b.id = q.business_id
join public.quote_line l on l.quote_id = q.id;

comment on view public.v_quote_line_detail is
  'Líneas congeladas con vigencia efectiva según la fecha local del negocio. Hereda RLS mediante security_invoker.';

revoke all on public.v_quote_line_detail from public, anon;
grant select on public.v_quote_line_detail to authenticated;

create or replace function public.validate_sale_quote_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
  v_status public.quote_status;
  v_valid_until date;
  v_local_today date;
begin
  if new.quote_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.quote_id is not distinct from old.quote_id then
    return new;
  end if;

  select q.business_id, q.status, q.valid_until,
         (current_timestamp at time zone b.timezone)::date
  into v_business, v_status, v_valid_until, v_local_today
  from public.quote q
  join public.business b on b.id = q.business_id
  where q.id = new.quote_id
  for key share of q;

  if v_business is null then
    raise exception using
      errcode = 'P0002',
      message = 'La cotización no existe.';
  end if;

  if v_business <> new.business_id then
    raise exception using
      errcode = '22023',
      message = 'La cotización y la venta deben pertenecer al mismo negocio.';
  end if;

  -- Si ya existe el vínculo, dejamos que el índice único emita su error
  -- específico. Además de conservar un diagnóstico estable, el índice sigue
  -- siendo la autoridad ante carreras entre transacciones.
  if exists (
    select 1
    from public.sale s
    where s.quote_id = new.quote_id
      and s.id is distinct from new.id
  ) then
    return new;
  end if;

  if v_status = 'EXPIRED'
     or (v_status = 'OPEN' and v_valid_until < v_local_today) then
    raise exception using
      errcode = '22023',
      message = 'La cotización está vencida y no se puede convertir.';
  end if;

  if v_status <> 'OPEN' then
    raise exception using
      errcode = '22023',
      message = 'Solo una cotización abierta se puede convertir.';
  end if;

  return new;
end;
$$;

comment on function public.validate_sale_quote_link() is
  'Impide enlazar una venta con una cotización vencida, cerrada o de otro negocio.';

revoke all on function public.validate_sale_quote_link() from public, anon, authenticated;

drop trigger if exists validate_sale_quote_link on public.sale;
create trigger validate_sale_quote_link
before insert or update of quote_id on public.sale
for each row execute function public.validate_sale_quote_link();
