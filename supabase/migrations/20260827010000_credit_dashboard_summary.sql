-- Totales del panel de Fiados. La suma vive en Postgres para no depender del
-- límite de filas del listado y para mantener una sola fuente de verdad.
create or replace function public.credit_dashboard_summary(
  p_business uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  total_debt bigint,
  debtor_count bigint,
  overdue_count bigint,
  overdue_amount bigint,
  paid_in_period bigint
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce((select sum(c.debt) from public.v_credits c where c.business_id = p_business), 0)::bigint,
    coalesce((select count(*) from public.v_credits c where c.business_id = p_business), 0)::bigint,
    coalesce((select count(*) from public.v_credits c where c.business_id = p_business and c.is_overdue), 0)::bigint,
    coalesce((select sum(c.debt) from public.v_credits c where c.business_id = p_business and c.is_overdue), 0)::bigint,
    coalesce((
      select sum(p.amount)
      from public.payment p
      where p.business_id = p_business
        and p.paid_at >= p_from
        and p.paid_at < p_to
    ), 0)::bigint
  where public.is_member(p_business)
    and p_from is not null
    and p_to is not null
    and p_from < p_to;
$$;

comment on function public.credit_dashboard_summary(uuid, timestamptz, timestamptz) is
  'Totales de cartera y abonos para el panel de Fiados; respeta RLS y usa rango temporal [from, to).';

revoke all on function public.credit_dashboard_summary(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.credit_dashboard_summary(uuid, timestamptz, timestamptz) to authenticated;

