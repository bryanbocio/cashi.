-- La vista con descuentos debe conservar la vigencia efectiva introducida en
-- 20260827070000_quote_expiration.sql. El estado persistido sigue siendo OPEN;
-- la vista deriva EXPIRED usando la fecha local del negocio.

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
  coalesce(l.gross_profit, 0) - q.discount as gross_profit,
  coalesce(l.detail, '') as detail,
  q.discount,
  (q.total + q.discount)::bigint as subtotal
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
  'Listado de cotizaciones con subtotal, descuento y total; deriva EXPIRED según la fecha local del negocio. Hereda RLS mediante security_invoker.';

revoke all on public.v_quote_detail from public, anon;
grant select on public.v_quote_detail to authenticated;
