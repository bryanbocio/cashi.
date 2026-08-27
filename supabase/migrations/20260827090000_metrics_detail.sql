-- S7.3 · Series, rentabilidad y alertas.
-- Los helpers privados con reloj explícito permiten probar todos los cortes de
-- calendario. Solo las cuatro RPC públicas se exponen al cliente.

create or replace function private.metric_business_timezone(p_business uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para consultar las métricas.';
  end if;

  if not public.is_member(p_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  select b.timezone into v_timezone
  from public.business b
  where b.id = p_business;

  return v_timezone;
end;
$$;

revoke all on function private.metric_business_timezone(uuid) from public, anon, authenticated;

-- Distribuye cada descuento proporcionalmente al ingreso bruto de sus líneas.
-- floor asigna la parte entera y el residuo (siempre menor que el número de
-- líneas) se entrega por mayor fracción y luego por UUID, de forma estable.
create or replace function private.metric_sale_lines(
  p_business uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  sale_id uuid,
  line_id uuid,
  product_key text,
  product_id uuid,
  product_name text,
  sku text,
  category_name text,
  qty integer,
  gross_revenue bigint,
  discount_allocated bigint,
  revenue bigint,
  gross_profit bigint,
  sold_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with source as (
    select
      s.id as sale_id,
      sl.id as line_id,
      coalesce(sl.product_id::text, 'deleted:' || sl.name_snapshot || ':' || coalesce(sl.category_snapshot, '')) as product_key,
      sl.product_id,
      sl.name_snapshot as product_name,
      p.sku,
      sl.category_snapshot as category_name,
      sl.qty,
      (sl.qty::numeric * sl.unit_price::numeric)::bigint as gross_revenue,
      (sl.qty::numeric * (sl.unit_price::numeric - sl.unit_cost::numeric))::bigint as line_profit,
      s.discount,
      sum(sl.qty::numeric * sl.unit_price::numeric) over (partition by s.id) as subtotal,
      s.sold_at
    from public.sale s
    join public.sale_line sl on sl.sale_id = s.id
    left join public.product p on p.id = sl.product_id
    where s.business_id = p_business
      and s.status = 'CONFIRMED'
      and s.sold_at >= p_from
      and s.sold_at < p_to
  ), floored as (
    select
      source.*,
      case when subtotal > 0
        then floor(discount::numeric * gross_revenue::numeric / subtotal)::bigint
        else 0::bigint
      end as discount_floor,
      case when subtotal > 0
        then discount::numeric * gross_revenue::numeric / subtotal
          - floor(discount::numeric * gross_revenue::numeric / subtotal)
        else 0::numeric
      end as fractional_remainder
    from source
  ), ranked as (
    select
      floored.*,
      discount - sum(discount_floor) over (partition by sale_id) as units_remaining,
      row_number() over (
        partition by sale_id
        order by fractional_remainder desc, line_id
      ) as remainder_rank
    from floored
  ), allocated as (
    select
      ranked.*,
      discount_floor + case when remainder_rank <= units_remaining then 1 else 0 end as allocated_discount
    from ranked
  )
  select
    sale_id,
    line_id,
    product_key,
    product_id,
    product_name,
    sku,
    category_name,
    qty,
    gross_revenue,
    allocated_discount,
    gross_revenue - allocated_discount,
    line_profit - allocated_discount,
    sold_at
  from allocated;
$$;

comment on function private.metric_sale_lines(uuid, timestamptz, timestamptz) is
  'Líneas confirmadas con descuento entero distribuido proporcionalmente; ingresos y ganancia reconcilian exactamente con metrics_summary.';

revoke all on function private.metric_sale_lines(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function private.metrics_daily_at(
  p_business uuid,
  p_days integer,
  p_now timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text := private.metric_business_timezone(p_business);
  v_days integer := coalesce(p_days, 0);
  v_today date;
  v_from date;
  v_to date;
  v_from_instant timestamptz;
  v_to_instant timestamptz;
  v_series jsonb;
begin
  if p_now is null then
    raise exception using errcode = '22004', message = 'La fecha de referencia es obligatoria.';
  end if;
  if v_days < 1 or v_days > 366 then
    raise exception using errcode = '22023', message = 'La serie diaria debe tener entre 1 y 366 días.';
  end if;

  v_today := (p_now at time zone v_timezone)::date;
  v_from := v_today - (v_days - 1);
  v_to := v_today + 1;
  v_from_instant := v_from::timestamp at time zone v_timezone;
  v_to_instant := v_to::timestamp at time zone v_timezone;

  with dates as (
    select day::date
    from generate_series(v_from, v_to - 1, interval '1 day') day
  ), daily as (
    select
      (l.sold_at at time zone v_timezone)::date as day,
      sum(l.revenue)::bigint as revenue,
      sum(l.gross_profit)::bigint as gross_profit,
      count(distinct l.sale_id)::bigint as sales_count
    from private.metric_sale_lines(p_business, v_from_instant, v_to_instant) l
    group by 1
  )
  select jsonb_agg(jsonb_build_object(
    'date', d.day,
    'revenue', coalesce(x.revenue, 0),
    'gross_profit', coalesce(x.gross_profit, 0),
    'sales_count', coalesce(x.sales_count, 0)
  ) order by d.day)
  into v_series
  from dates d
  left join daily x on x.day = d.day;

  return jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'days', coalesce(v_series, '[]'::jsonb)
  );
end;
$$;

revoke all on function private.metrics_daily_at(uuid, integer, timestamptz) from public, anon, authenticated;

create or replace function public.metrics_daily(p_business uuid, p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.metrics_daily_at(p_business, p_days, current_timestamp);
$$;

comment on function public.metrics_daily(uuid, integer) is
  'Serie continua de días locales, incluido hoy, con ingresos, ganancia bruta y cantidad de ventas; completa días sin ventas con cero.';

revoke all on function public.metrics_daily(uuid, integer) from public, anon;
grant execute on function public.metrics_daily(uuid, integer) to authenticated;

create or replace function private.metrics_products_at(
  p_business uuid,
  p_period text,
  p_month_offset integer,
  p_limit integer,
  p_now timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text := private.metric_business_timezone(p_business);
  v_limit integer := coalesce(p_limit, 0);
  v_range record;
  v_products jsonb;
begin
  if v_limit < 1 or v_limit > 100 then
    raise exception using errcode = '22023', message = 'El límite de productos debe estar entre 1 y 100.';
  end if;

  select * into v_range
  from private.period_range_at(v_timezone, p_period, p_month_offset, p_now);

  with grouped as (
    select
      l.product_key,
      (array_agg(l.product_id order by l.sold_at desc, l.line_id desc))[1] as product_id,
      (array_agg(l.product_name order by l.sold_at desc, l.line_id desc))[1] as product_name,
      (array_agg(l.sku order by l.sold_at desc, l.line_id desc) filter (where l.sku is not null))[1] as sku,
      (array_agg(l.category_name order by l.sold_at desc, l.line_id desc))[1] as category_name,
      sum(l.qty)::bigint as qty,
      sum(l.revenue)::bigint as revenue,
      sum(l.gross_profit)::bigint as gross_profit,
      count(distinct l.sale_id)::bigint as sales_count
    from private.metric_sale_lines(p_business, v_range."from", v_range."to") l
    group by l.product_key
  ), limited as (
    select *
    from grouped
    order by gross_profit desc, revenue desc, product_name, product_key
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', product_id,
    'name', product_name,
    'sku', sku,
    'category', coalesce(category_name, 'Sin categoría'),
    'qty', qty,
    'revenue', revenue,
    'gross_profit', gross_profit,
    'margin_pct', case when revenue <> 0 then round(gross_profit::numeric / revenue * 100, 1) end,
    'sales_count', sales_count
  ) order by gross_profit desc, revenue desc, product_name), '[]'::jsonb)
  into v_products
  from limited;

  return jsonb_build_object(
    'range', jsonb_build_object(
      'from', (v_range."from" at time zone v_timezone)::date,
      'to', (v_range."to" at time zone v_timezone)::date,
      'label', v_range.label
    ),
    'products', v_products
  );
end;
$$;

revoke all on function private.metrics_products_at(uuid, text, integer, integer, timestamptz) from public, anon, authenticated;

create or replace function public.metrics_products(
  p_business uuid,
  p_period text,
  p_month_offset integer,
  p_limit integer default 6
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.metrics_products_at(
    p_business, p_period, p_month_offset, p_limit, current_timestamp
  );
$$;

comment on function public.metrics_products(uuid, text, integer, integer) is
  'Rentabilidad histórica por producto dentro del mismo rango de metrics_summary, con descuentos proporcionales y límite de 1 a 100.';

revoke all on function public.metrics_products(uuid, text, integer, integer) from public, anon;
grant execute on function public.metrics_products(uuid, text, integer, integer) to authenticated;

create or replace function private.metrics_categories_at(
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
  v_timezone text := private.metric_business_timezone(p_business);
  v_range record;
  v_categories jsonb;
begin
  select * into v_range
  from private.period_range_at(v_timezone, p_period, p_month_offset, p_now);

  with grouped as (
    select
      coalesce(l.category_name, 'Sin categoría') as category,
      sum(l.qty)::bigint as qty,
      sum(l.revenue)::bigint as revenue,
      sum(l.gross_profit)::bigint as gross_profit,
      count(distinct l.sale_id)::bigint as sales_count,
      count(distinct l.product_key)::bigint as product_count
    from private.metric_sale_lines(p_business, v_range."from", v_range."to") l
    group by coalesce(l.category_name, 'Sin categoría')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'category', category,
    'qty', qty,
    'revenue', revenue,
    'gross_profit', gross_profit,
    'margin_pct', case when revenue <> 0 then round(gross_profit::numeric / revenue * 100, 1) end,
    'sales_count', sales_count,
    'product_count', product_count
  ) order by gross_profit desc, revenue desc, category), '[]'::jsonb)
  into v_categories
  from grouped;

  return jsonb_build_object(
    'range', jsonb_build_object(
      'from', (v_range."from" at time zone v_timezone)::date,
      'to', (v_range."to" at time zone v_timezone)::date,
      'label', v_range.label
    ),
    'categories', v_categories
  );
end;
$$;

revoke all on function private.metrics_categories_at(uuid, text, integer, timestamptz) from public, anon, authenticated;

create or replace function public.metrics_categories(
  p_business uuid,
  p_period text,
  p_month_offset integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.metrics_categories_at(
    p_business, p_period, p_month_offset, current_timestamp
  );
$$;

comment on function public.metrics_categories(uuid, text, integer) is
  'Rentabilidad histórica por categoría congelada dentro del mismo rango de metrics_summary, con descuentos proporcionales.';

revoke all on function public.metrics_categories(uuid, text, integer) from public, anon;
grant execute on function public.metrics_categories(uuid, text, integer) to authenticated;

create or replace function private.metrics_alerts_at(
  p_business uuid,
  p_now timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text := private.metric_business_timezone(p_business);
  v_today date;
  v_alerts jsonb := '[]'::jsonb;
  v_count bigint;
  v_amount numeric;
  v_items jsonb;
begin
  if p_now is null then
    raise exception using errcode = '22004', message = 'La fecha de referencia es obligatoria.';
  end if;
  v_today := (p_now at time zone v_timezone)::date;

  with ranked as (
    select
      p.id, p.name, p.sku, p.stock, p.min_stock,
      greatest(p.min_stock::bigint * 2 - p.stock::bigint, 1) as suggested_qty,
      row_number() over (order by p.stock - p.min_stock, p.name, p.id) as rn
    from public.product p
    where p.business_id = p_business and p.active and p.stock < p.min_stock
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'product_id', id, 'name', name, 'sku', sku, 'stock', stock,
    'min_stock', min_stock, 'suggested_qty', suggested_qty
  ) order by rn) filter (where rn <= 5), '[]'::jsonb)
  into v_count, v_items
  from ranked;

  if v_count > 0 then
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'type', 'LOW_STOCK', 'severity', 'negative', 'count', v_count,
      'title', v_count || case when v_count = 1 then ' producto bajo el mínimo' else ' productos bajo el mínimo' end,
      'target', '/inventario?filter=low', 'items', v_items
    ));
  end if;

  with credit_sales as (
    select
      s.id, s.customer_id, s.total, s.due_date, s.sold_at,
      sum(s.total) over (
        partition by s.customer_id
        order by s.due_date nulls last, s.sold_at, s.id
        rows between unbounded preceding and current row
      ) as running_credit
    from public.sale s
    where s.business_id = p_business
      and s.payment_method = 'CREDIT'
      and s.status = 'CONFIRMED'
  ), payments as (
    select p.customer_id, sum(p.amount)::bigint as total_paid
    from public.payment p
    where p.business_id = p_business
    group by p.customer_id
  ), balances as (
    select
      s.customer_id,
      sum(s.total)::bigint - coalesce(p.total_paid, 0) as debt,
      min(s.due_date) filter (where s.running_credit > coalesce(p.total_paid, 0)) as oldest_due_date
    from credit_sales s
    left join payments p on p.customer_id = s.customer_id
    group by s.customer_id, p.total_paid
  ), ranked as (
    select
      c.id, c.name, c.phone, b.debt, b.oldest_due_date,
      (v_today - b.oldest_due_date)::integer as days_overdue,
      row_number() over (order by b.oldest_due_date, b.debt desc, c.name, c.id) as rn
    from balances b
    join public.customer c on c.id = b.customer_id and c.business_id = p_business
    where b.debt > 0 and b.oldest_due_date < v_today
  )
  select count(*), coalesce(sum(debt), 0), coalesce(jsonb_agg(jsonb_build_object(
    'customer_id', id, 'name', name, 'phone', phone, 'debt', debt,
    'due_date', oldest_due_date, 'days_overdue', days_overdue
  ) order by rn) filter (where rn <= 5), '[]'::jsonb)
  into v_count, v_amount, v_items
  from ranked;

  if v_count > 0 then
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'type', 'OVERDUE_CREDIT', 'severity', 'negative', 'count', v_count,
      'amount', v_amount,
      'title', v_count || case when v_count = 1 then ' cliente con fiado vencido' else ' clientes con fiados vencidos' end,
      'target', '/fiados', 'items', v_items
    ));
  end if;

  with orders as (
    select
      po.id, po.code, po.expected_at, po.created_at,
      coalesce(s.name, 'Varios proveedores') as supplier_name,
      coalesce(sum(pl.qty), 0)::bigint as total_units,
      coalesce(sum(pl.qty::numeric * pl.unit_cost::numeric), 0)::bigint as total_cost
    from public.purchase_order po
    left join public.supplier s on s.id = po.supplier_id
    left join public.purchase_line pl on pl.purchase_order_id = po.id
    where po.business_id = p_business and po.status = 'PENDING'
    group by po.id, s.name
  ), ranked as (
    select *, row_number() over (order by expected_at nulls last, created_at, id) as rn
    from orders
  )
  select count(*), coalesce(sum(total_cost), 0), coalesce(jsonb_agg(jsonb_build_object(
    'order_id', id, 'code', code, 'supplier', supplier_name,
    'expected_at', expected_at, 'total_units', total_units, 'total_cost', total_cost
  ) order by rn) filter (where rn <= 5), '[]'::jsonb)
  into v_count, v_amount, v_items
  from ranked;

  if v_count > 0 then
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'type', 'PENDING_PURCHASE', 'severity', 'neutral', 'count', v_count,
      'amount', v_amount,
      'title', v_count || case when v_count = 1 then ' orden sin recibir' else ' órdenes sin recibir' end,
      'target', '/compras', 'items', v_items
    ));
  end if;

  with ranked as (
    select
      p.id, p.name, p.sku, p.cost, p.price,
      case when p.price > 0
        then round((p.price - p.cost)::numeric * 100 / p.price, 2)
      end as margin_pct,
      row_number() over (
        order by
          case when p.price = 0 then -1::numeric else (p.price - p.cost)::numeric / p.price end,
          p.name, p.id
      ) as rn
    from public.product p
    where p.business_id = p_business
      and p.active
      and (
        (p.price = 0 and p.cost > 0)
        or (p.price > 0 and (p.price - p.cost)::numeric * 100 / p.price < 20)
      )
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'product_id', id, 'name', name, 'sku', sku, 'cost', cost,
    'price', price, 'margin_pct', margin_pct
  ) order by rn) filter (where rn <= 5), '[]'::jsonb)
  into v_count, v_items
  from ranked;

  if v_count > 0 then
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'type', 'THIN_MARGIN', 'severity', 'neutral', 'count', v_count,
      'title', v_count || case when v_count = 1 then ' producto con margen estrecho' else ' productos con margen estrecho' end,
      'target', '/inventario?filter=thin', 'items', v_items
    ));
  end if;

  return jsonb_build_object(
    'generated_on', v_today,
    'count', jsonb_array_length(v_alerts),
    'alerts', v_alerts
  );
end;
$$;

revoke all on function private.metrics_alerts_at(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.metrics_alerts(p_business uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.metrics_alerts_at(p_business, current_timestamp);
$$;

comment on function public.metrics_alerts(uuid) is
  'Alertas agrupadas y navegables de stock bajo, fiados vencidos, órdenes pendientes y margen estrecho; devuelve hasta cinco detalles por grupo.';

revoke all on function public.metrics_alerts(uuid) from public, anon;
grant execute on function public.metrics_alerts(uuid) to authenticated;
