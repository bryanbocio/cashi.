-- S7.2 · Resumen financiero por periodo.
-- La variante privada acepta un reloj explícito para probar límites sin
-- depender de la fecha de ejecución. La RPC pública siempre usa ahora.

create or replace function private.metrics_summary_at(
  p_business uuid,
  p_period text,
  p_month_offset integer,
  p_now timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_timezone text;
  v_range record;
  v_from_date date;
  v_to_date date;
  v_prev_from_date date;
  v_prev_to_date date;
  v_revenue numeric := 0;
  v_gross numeric := 0;
  v_sales_count bigint := 0;
  v_prev_revenue numeric := 0;
  v_prev_gross numeric := 0;
  v_expenses numeric := 0;
  v_prev_expenses numeric := 0;
  v_net numeric := 0;
  v_prev_net numeric := 0;
  v_receivable numeric := 0;
  v_debtors_count bigint := 0;
  v_revenue_change numeric := 0;
  v_gross_margin numeric := 0;
  v_prev_gross_margin numeric := 0;
  v_expense_ratio numeric := 0;
  v_prev_expense_ratio numeric := 0;
  v_net_margin numeric := 0;
  v_net_profit_change numeric := 0;
begin
  if v_user is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para consultar las métricas.';
  end if;

  if not public.is_member(p_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  select b.timezone
  into v_timezone
  from public.business b
  where b.id = p_business;

  select *
  into v_range
  from private.period_range_at(v_timezone, p_period, p_month_offset, p_now);

  v_from_date := (v_range."from" at time zone v_timezone)::date;
  v_to_date := (v_range."to" at time zone v_timezone)::date;
  v_prev_from_date := (v_range.prev_from at time zone v_timezone)::date;
  v_prev_to_date := (v_range.prev_to at time zone v_timezone)::date;

  -- Primero se agrega cada venta para restar su descuento exactamente una vez,
  -- sin multiplicarlo por la cantidad de líneas.
  with sale_profit as (
    select
      s.id,
      s.sold_at,
      s.total::numeric as revenue,
      coalesce(sum(sl.qty::numeric * (sl.unit_price::numeric - sl.unit_cost::numeric)), 0)
        - s.discount::numeric as gross_profit
    from public.sale s
    left join public.sale_line sl on sl.sale_id = s.id
    where s.business_id = p_business
      and s.status = 'CONFIRMED'
      and s.sold_at >= v_range.prev_from
      and s.sold_at < v_range."to"
    group by s.id
  )
  select
    coalesce(sum(revenue) filter (
      where sold_at >= v_range."from" and sold_at < v_range."to"
    ), 0),
    coalesce(sum(gross_profit) filter (
      where sold_at >= v_range."from" and sold_at < v_range."to"
    ), 0),
    count(*) filter (
      where sold_at >= v_range."from" and sold_at < v_range."to"
    ),
    coalesce(sum(revenue) filter (
      where sold_at >= v_range.prev_from and sold_at < v_range.prev_to
    ), 0),
    coalesce(sum(gross_profit) filter (
      where sold_at >= v_range.prev_from and sold_at < v_range.prev_to
    ), 0)
  into v_revenue, v_gross, v_sales_count, v_prev_revenue, v_prev_gross
  from sale_profit;

  select
    coalesce(sum(e.amount::numeric) filter (
      where e.spent_at >= v_from_date and e.spent_at < v_to_date
    ), 0),
    coalesce(sum(e.amount::numeric) filter (
      where e.spent_at >= v_prev_from_date and e.spent_at < v_prev_to_date
    ), 0)
  into v_expenses, v_prev_expenses
  from public.expense e
  where e.business_id = p_business
    and e.spent_at >= v_prev_from_date
    and e.spent_at < v_to_date;

  -- La cartera es una fotografía actual y no cambia al navegar periodos. Cada
  -- cliente aporta como mínimo cero para tolerar datos históricos importados.
  with credit_totals as (
    select s.customer_id, sum(s.total::numeric) as total
    from public.sale s
    where s.business_id = p_business
      and s.customer_id is not null
      and s.payment_method = 'CREDIT'
      and s.status = 'CONFIRMED'
    group by s.customer_id
  ), payment_totals as (
    select p.customer_id, sum(p.amount::numeric) as total
    from public.payment p
    where p.business_id = p_business
    group by p.customer_id
  ), balances as (
    select greatest(c.total - coalesce(p.total, 0), 0) as debt
    from credit_totals c
    left join payment_totals p on p.customer_id = c.customer_id
  )
  select coalesce(sum(debt), 0), count(*) filter (where debt > 0)
  into v_receivable, v_debtors_count
  from balances;

  v_net := v_gross - v_expenses;
  v_prev_net := v_prev_gross - v_prev_expenses;

  if v_prev_revenue <> 0 then
    v_revenue_change := round((v_revenue - v_prev_revenue) / v_prev_revenue * 100, 1);
  end if;
  if v_revenue <> 0 then
    v_gross_margin := round(v_gross / v_revenue * 100, 1);
    v_expense_ratio := round(v_expenses / v_revenue * 100, 1);
    v_net_margin := round(v_net / v_revenue * 100, 1);
  end if;
  if v_prev_revenue <> 0 then
    v_prev_gross_margin := round(v_prev_gross / v_prev_revenue * 100, 1);
    v_prev_expense_ratio := round(v_prev_expenses / v_prev_revenue * 100, 1);
  end if;
  if v_prev_net <> 0 then
    v_net_profit_change := round((v_net - v_prev_net) / v_prev_net * 100, 1);
  end if;

  return jsonb_build_object(
    'range', jsonb_build_object(
      'from', v_from_date,
      'to', v_to_date,
      'label', v_range.label,
      'previous_label', v_range.previous_label
    ),
    'revenue', v_revenue,
    'gross_profit', v_gross,
    'expenses', v_expenses,
    'net_profit', v_net,
    'receivable', v_receivable,
    'sales_count', v_sales_count,
    'debtors_count', v_debtors_count,
    'pct', jsonb_build_object(
      'revenue_change', v_revenue_change,
      'gross_margin', v_gross_margin,
      'gross_margin_pp', round(v_gross_margin - v_prev_gross_margin, 1),
      'expense_ratio', v_expense_ratio,
      'expense_ratio_pp', round(v_expense_ratio - v_prev_expense_ratio, 1),
      'net_margin', v_net_margin,
      'net_profit_change', v_net_profit_change
    )
  );
end;
$$;

comment on function private.metrics_summary_at(uuid, text, integer, timestamptz) is
  'Implementación determinista de metrics_summary para validar periodos y zonas horarias con un reloj explícito.';

revoke all on function private.metrics_summary_at(uuid, text, integer, timestamptz) from public, anon, authenticated;

create or replace function public.metrics_summary(
  p_business uuid,
  p_period text,
  p_month_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.metrics_summary_at(
    p_business,
    p_period,
    p_month_offset,
    current_timestamp
  );
$$;

comment on function public.metrics_summary(uuid, text, integer) is
  'Resumen financiero del periodo y comparación anterior: ingresos, bruta, gastos, neta, cartera, conteos, márgenes, proporciones y variaciones.';

revoke all on function public.metrics_summary(uuid, text, integer) from public, anon;
grant execute on function public.metrics_summary(uuid, text, integer) to authenticated;
