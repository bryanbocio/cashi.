begin;

create extension if not exists pgtap with schema extensions;
select plan(73);

insert into public.business (id, name, timezone, created_by)
values
  ('20000000-0000-0000-0000-000000000030', 'Detalle de métricas', 'America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000031', 'Métricas sin alertas', 'UTC', '10000000-0000-0000-0000-000000000001');

insert into public.membership (business_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000001', 'OWNER'),
  ('20000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000001', 'OWNER');

insert into public.customer (id, business_id, name)
values
  ('60000000-0000-0000-0000-000000000030', '20000000-0000-0000-0000-000000000030', 'Cliente vencido'),
  ('60000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000030', 'Cliente que vence hoy');

insert into public.supplier (id, business_id, name)
values ('40000000-0000-0000-0000-000000000030', '20000000-0000-0000-0000-000000000030', 'Proveedor métrico');

insert into public.product (id, business_id, name, sku, cost, price, stock, min_stock, active)
values
  ('50000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000030', 'Producto A', 'MET-A', 60, 100, 1, 5, true),
  ('50000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000030', 'Producto B', 'MET-B', 100, 200, 5, 5, true),
  ('50000000-0000-0000-0000-000000000033', '20000000-0000-0000-0000-000000000030', 'Sin precio', 'MET-C', 10, 0, 10, 1, true),
  ('50000000-0000-0000-0000-000000000034', '20000000-0000-0000-0000-000000000030', 'Producto eliminado', 'MET-D', 20, 50, 10, 1, true),
  ('50000000-0000-0000-0000-000000000035', '20000000-0000-0000-0000-000000000030', 'Margen quince', 'MET-E', 85, 100, 10, 1, true),
  ('50000000-0000-0000-0000-000000000036', '20000000-0000-0000-0000-000000000030', 'Inactivo crítico', 'MET-F', 90, 100, 0, 5, false);

insert into public.sale (
  id, business_id, code, customer_id, payment_method, status,
  total, discount, due_date, sold_at, created_by
) values
  ('72000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000030', 'DET-JUN-1', null, 'CASH', 'CONFIRMED', 290, 10, null, '2026-06-01 10:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000030', 'DET-JUN-2', null, 'CASH', 'CONFIRMED', 99, 1, null, '2026-06-02 10:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000030', 'DET-JUN-3', null, 'CASH', 'CONFIRMED', 0, 0, null, '2026-06-03 10:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000030', 'DET-JUN-4', null, 'CASH', 'CONFIRMED', 50, 0, null, '2026-06-04 10:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000030', 'DET-MAY', null, 'CASH', 'CONFIRMED', 100, 0, null, '2026-05-15 10:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000030', 'DET-JUL', null, 'CASH', 'CONFIRMED', 200, 0, null, '2026-07-01 00:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000030', 'DET-VOID', null, 'CASH', 'VOID', 100, 0, null, '2026-06-05 10:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000030', 'DET-CREDIT-LATE', '60000000-0000-0000-0000-000000000030', 'CREDIT', 'CONFIRMED', 300, 0, '2026-06-01', '2026-05-01 10:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000030', 'DET-CREDIT-TODAY', '60000000-0000-0000-0000-000000000031', 'CREDIT', 'CONFIRMED', 500, 0, '2026-06-05', '2026-05-02 10:00 America/Bogota', '10000000-0000-0000-0000-000000000001');

insert into public.sale_line (sale_id, product_id, name_snapshot, category_snapshot, qty, unit_price, unit_cost)
values
  ('72000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000031', 'Producto A', 'Perfumes', 1, 100, 60),
  ('72000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000032', 'Producto B', 'Ropa', 1, 200, 100),
  ('72000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000031', 'Producto A', 'Perfumes', 2, 50, 20),
  ('72000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000033', 'Sin precio', null, 1, 0, 0),
  ('72000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000034', 'Producto eliminado', 'Accesorios', 1, 50, 20),
  ('72000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000031', 'Producto A', 'Perfumes', 1, 100, 60),
  ('72000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000032', 'Producto B', 'Ropa', 1, 200, 100),
  ('72000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000031', 'Producto A', 'Perfumes', 1, 100, 60),
  ('72000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000031', 'Producto A', 'Perfumes', 1, 300, 100),
  ('72000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000032', 'Producto B', 'Ropa', 1, 500, 250);

insert into public.payment (business_id, customer_id, amount, method, paid_at)
values ('20000000-0000-0000-0000-000000000030', '60000000-0000-0000-0000-000000000030', 100, 'CASH', '2026-06-03 12:00 America/Bogota');

insert into public.purchase_order (id, business_id, code, supplier_id, status, expected_at)
values ('73000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000030', 'OC-DET-PENDING', '40000000-0000-0000-0000-000000000030', 'PENDING', '2026-06-04');
insert into public.purchase_order (id, business_id, code, supplier_id, status, expected_at, received_at)
values ('73000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000030', 'OC-DET-RECEIVED', '40000000-0000-0000-0000-000000000030', 'RECEIVED', '2026-06-03', '2026-06-03 12:00+00');
insert into public.purchase_line (purchase_order_id, product_id, qty, unit_cost)
values
  ('73000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000031', 2, 60),
  ('73000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000032', 1, 100);

-- El histórico debe sobrevivir aunque el producto ya no exista.
delete from public.product where id = '50000000-0000-0000-0000-000000000034';

select ok(not has_function_privilege('anon', 'public.metrics_daily(uuid,integer)', 'execute'), 'anon cannot execute metrics_daily');
select ok(has_function_privilege('authenticated', 'public.metrics_daily(uuid,integer)', 'execute'), 'authenticated can execute metrics_daily');
select ok(not has_function_privilege('anon', 'public.metrics_products(uuid,text,integer,integer)', 'execute'), 'anon cannot execute metrics_products');
select ok(has_function_privilege('authenticated', 'public.metrics_products(uuid,text,integer,integer)', 'execute'), 'authenticated can execute metrics_products');
select ok(not has_function_privilege('anon', 'public.metrics_categories(uuid,text,integer)', 'execute'), 'anon cannot execute metrics_categories');
select ok(has_function_privilege('authenticated', 'public.metrics_categories(uuid,text,integer)', 'execute'), 'authenticated can execute metrics_categories');
select ok(not has_function_privilege('anon', 'public.metrics_alerts(uuid)', 'execute'), 'anon cannot execute metrics_alerts');
select ok(has_function_privilege('authenticated', 'public.metrics_alerts(uuid)', 'execute'), 'authenticated can execute metrics_alerts');
select ok(not has_function_privilege('authenticated', 'private.metric_sale_lines(uuid,timestamptz,timestamptz)', 'execute'), 'the allocation helper is private');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select discount_allocated from private.metric_sale_lines('20000000-0000-0000-0000-000000000030', '2026-06-01 00:00 America/Bogota', '2026-07-01 00:00 America/Bogota') where line_id = (select id from public.sale_line where sale_id = '72000000-0000-0000-0000-000000000001' and product_id = '50000000-0000-0000-0000-000000000031')), 3::bigint, 'the smaller line receives its proportional integer discount');
select is((select discount_allocated from private.metric_sale_lines('20000000-0000-0000-0000-000000000030', '2026-06-01 00:00 America/Bogota', '2026-07-01 00:00 America/Bogota') where line_id = (select id from public.sale_line where sale_id = '72000000-0000-0000-0000-000000000001' and product_id = '50000000-0000-0000-0000-000000000032')), 7::bigint, 'the largest remainder receives the final discount unit');
select is((select sum(discount_allocated) from private.metric_sale_lines('20000000-0000-0000-0000-000000000030', '2026-06-01 00:00 America/Bogota', '2026-07-01 00:00 America/Bogota') where sale_id = '72000000-0000-0000-0000-000000000001'), 10::numeric, 'allocated line discounts reconcile with the sale discount');

create temporary table detail_daily as
select private.metrics_daily_at('20000000-0000-0000-0000-000000000030', 5, '2026-06-05 12:00+00') as payload;

select is((select payload #>> '{range,from}' from detail_daily), '2026-06-01', 'daily range starts four local dates before today');
select is((select payload #>> '{range,to}' from detail_daily), '2026-06-06', 'daily range uses an exclusive next-day boundary');
select is((select jsonb_array_length(payload -> 'days') from detail_daily), 5, 'daily series has exactly the requested length');
select is((select (payload #>> '{days,0,revenue}')::bigint from detail_daily), 290::bigint, 'first day revenue is net of the exact discount');
select is((select (payload #>> '{days,0,gross_profit}')::bigint from detail_daily), 130::bigint, 'first day profit subtracts the exact discount');
select is((select (payload #>> '{days,0,sales_count}')::bigint from detail_daily), 1::bigint, 'first day counts the sale once despite two lines');
select is((select (payload #>> '{days,1,revenue}')::bigint from detail_daily), 99::bigint, 'second day revenue is exact');
select is((select (payload #>> '{days,1,gross_profit}')::bigint from detail_daily), 59::bigint, 'second day profit is exact');
select is((select payload #> '{days,2}' from detail_daily), '{"date":"2026-06-03","revenue":0,"gross_profit":0,"sales_count":1}'::jsonb, 'a zero-value confirmed sale still counts');
select is((select (payload #>> '{days,3,revenue}')::bigint from detail_daily), 50::bigint, 'deleted product history remains in the series');
select is((select payload #> '{days,4}' from detail_daily), '{"date":"2026-06-05","revenue":0,"gross_profit":0,"sales_count":0}'::jsonb, 'a day without confirmed sales is filled with zero');

create temporary table detail_products as
select private.metrics_products_at('20000000-0000-0000-0000-000000000030', 'month', 1, 100, '2026-07-15 12:00+00') as payload;
create temporary table detail_categories as
select private.metrics_categories_at('20000000-0000-0000-0000-000000000030', 'month', 1, '2026-07-15 12:00+00') as payload;
create temporary table detail_summary as
select private.metrics_summary_at('20000000-0000-0000-0000-000000000030', 'month', 1, '2026-07-15 12:00+00') as payload;

select is((select payload #>> '{range,from}' from detail_products), '2026-06-01', 'product metrics use the summary start date');
select is((select payload #>> '{range,to}' from detail_products), '2026-07-01', 'product metrics use the summary end date');
select is((select payload #>> '{range,label}' from detail_products), 'junio 2026', 'product metrics expose the same label');
select is((select jsonb_array_length(payload -> 'products') from detail_products), 4, 'all four historically sold products are returned');
select is((select payload #>> '{products,0,product_id}' from detail_products), '50000000-0000-0000-0000-000000000031', 'products are ordered by gross profit');
select is((select (payload #>> '{products,0,revenue}')::bigint from detail_products), 196::bigint, 'product A receives exact net revenue');
select is((select (payload #>> '{products,0,gross_profit}')::bigint from detail_products), 96::bigint, 'product A receives exact net gross profit');
select is((select (payload #>> '{products,0,qty}')::bigint from detail_products), 3::bigint, 'product A aggregates units across sales');
select is((select (payload #>> '{products,0,margin_pct}')::numeric from detail_products), 49.0::numeric, 'product A margin uses net revenue and profit');
select is((select (payload #>> '{products,1,revenue}')::bigint from detail_products), 193::bigint, 'product B receives the largest-remainder allocation');
select is((select (payload #>> '{products,1,gross_profit}')::bigint from detail_products), 93::bigint, 'product B profit subtracts its allocated discount');
select is((select (payload #>> '{products,1,margin_pct}')::numeric from detail_products), 48.2::numeric, 'product B margin is rounded to one decimal');
select ok((select payload #> '{products,2,product_id}' = 'null'::jsonb from detail_products), 'a deleted product keeps a null product id');
select is((select payload #>> '{products,2,name}' from detail_products), 'Producto eliminado', 'a deleted product keeps its frozen name');
select ok((select payload #> '{products,3,margin_pct}' = 'null'::jsonb from detail_products), 'zero revenue has an undefined margin');
select is((select jsonb_array_length(private.metrics_products_at('20000000-0000-0000-0000-000000000030', 'month', 1, 2, '2026-07-15 12:00+00') -> 'products')), 2, 'the product limit is applied after aggregation and sorting');
select is((select sum((item ->> 'revenue')::bigint)::bigint from detail_products, lateral jsonb_array_elements(payload -> 'products') item), (select (payload ->> 'revenue')::bigint from detail_summary), 'product revenues reconcile with metrics_summary');
select is((select sum((item ->> 'gross_profit')::bigint)::bigint from detail_products, lateral jsonb_array_elements(payload -> 'products') item), (select (payload ->> 'gross_profit')::bigint from detail_summary), 'product profits reconcile with metrics_summary');

select is((select jsonb_array_length(payload -> 'categories') from detail_categories), 4, 'historical categories include uncategorized and deleted products');
select is((select (item ->> 'revenue')::bigint from detail_categories, lateral jsonb_array_elements(payload -> 'categories') item where item ->> 'category' = 'Perfumes'), 196::bigint, 'Perfumes revenue is exact');
select is((select (item ->> 'gross_profit')::bigint from detail_categories, lateral jsonb_array_elements(payload -> 'categories') item where item ->> 'category' = 'Perfumes'), 96::bigint, 'Perfumes profit is exact');
select is((select (item ->> 'gross_profit')::bigint from detail_categories, lateral jsonb_array_elements(payload -> 'categories') item where item ->> 'category' = 'Ropa'), 93::bigint, 'Ropa profit is exact');
select is((select (item ->> 'gross_profit')::bigint from detail_categories, lateral jsonb_array_elements(payload -> 'categories') item where item ->> 'category' = 'Accesorios'), 30::bigint, 'a deleted product keeps its category snapshot');
select ok((select item -> 'margin_pct' = 'null'::jsonb from detail_categories, lateral jsonb_array_elements(payload -> 'categories') item where item ->> 'category' = 'Sin categoría'), 'the zero-revenue category has an undefined margin');
select is((select sum((item ->> 'revenue')::bigint)::bigint from detail_categories, lateral jsonb_array_elements(payload -> 'categories') item), (select (payload ->> 'revenue')::bigint from detail_summary), 'category revenues reconcile with metrics_summary');
select is((select sum((item ->> 'gross_profit')::bigint)::bigint from detail_categories, lateral jsonb_array_elements(payload -> 'categories') item), (select (payload ->> 'gross_profit')::bigint from detail_summary), 'category profits reconcile with metrics_summary');
select is((select payload #>> '{range,from}' from detail_categories), (select payload #>> '{range,from}' from detail_summary), 'category metrics use the same summary range');

create temporary table detail_alerts as
select private.metrics_alerts_at('20000000-0000-0000-0000-000000000030', '2026-06-05 12:00+00') as payload;

select is((select (payload ->> 'count')::integer from detail_alerts), 4, 'all four alert groups are present');
select is((select jsonb_path_query_array(payload, '$.alerts[*].type') from detail_alerts), '["LOW_STOCK","OVERDUE_CREDIT","PENDING_PURCHASE","THIN_MARGIN"]'::jsonb, 'alert groups have a stable operational order');
select is((select (a ->> 'count')::bigint from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'LOW_STOCK'), 1::bigint, 'only active products strictly below minimum are alerted');
select is((select (a #>> '{items,0,suggested_qty}')::bigint from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'LOW_STOCK'), 9::bigint, 'stock alert uses the replenishment formula');
select is((select (a ->> 'count')::bigint from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'OVERDUE_CREDIT'), 1::bigint, 'a due date equal to today is not overdue');
select is((select (a ->> 'amount')::bigint from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'OVERDUE_CREDIT'), 200::bigint, 'overdue amount subtracts payments');
select is((select (a #>> '{items,0,days_overdue}')::integer from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'OVERDUE_CREDIT'), 4, 'overdue days use the business-local date');
select is((select (a ->> 'count')::bigint from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'PENDING_PURCHASE'), 1::bigint, 'received orders are excluded from alerts');
select is((select (a ->> 'amount')::bigint from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'PENDING_PURCHASE'), 120::bigint, 'pending purchase amount uses its lines');
select is((select (a ->> 'count')::bigint from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'THIN_MARGIN'), 2::bigint, 'thin margin includes no-price-with-cost and below twenty percent');
select ok((select exists (select 1 from jsonb_array_elements(a -> 'items') item where item ->> 'sku' = 'MET-C' and item -> 'margin_pct' = 'null'::jsonb) from detail_alerts, lateral jsonb_array_elements(payload -> 'alerts') a where a ->> 'type' = 'THIN_MARGIN'), 'a product with cost but no price has an undefined alerted margin');

select is(private.metrics_alerts_at('20000000-0000-0000-0000-000000000031', '2026-06-05 12:00+00') -> 'alerts', '[]'::jsonb, 'a healthy empty business returns no alerts');
select is((private.metrics_alerts_at('20000000-0000-0000-0000-000000000031', '2026-06-05 12:00+00') ->> 'count')::integer, 0, 'an empty alert response has count zero');

select throws_ok($$select private.metrics_daily_at('20000000-0000-0000-0000-000000000030', 0, '2026-06-05 12:00+00')$$, '22023', 'La serie diaria debe tener entre 1 y 366 días.', 'zero days is rejected');
select throws_ok($$select private.metrics_daily_at('20000000-0000-0000-0000-000000000030', 367, '2026-06-05 12:00+00')$$, '22023', 'La serie diaria debe tener entre 1 y 366 días.', 'more than 366 days is rejected');
select throws_ok($$select private.metrics_products_at('20000000-0000-0000-0000-000000000030', 'month', 0, 0, '2026-06-05 12:00+00')$$, '22023', 'El límite de productos debe estar entre 1 y 100.', 'zero product limit is rejected');
select throws_ok($$select private.metrics_products_at('20000000-0000-0000-0000-000000000030', 'month', 0, 101, '2026-06-05 12:00+00')$$, '22023', 'El límite de productos debe estar entre 1 y 100.', 'product limits above one hundred are rejected');
select throws_ok($$select private.metrics_products_at('20000000-0000-0000-0000-000000000030', 'quarter', 0, 6, '2026-06-05 12:00+00')$$, '22023', 'El periodo debe ser today, 7d o month.', 'product metrics reject unsupported periods');
select throws_ok($$select private.metrics_categories_at('20000000-0000-0000-0000-000000000030', 'quarter', 0, '2026-06-05 12:00+00')$$, '22023', 'El periodo debe ser today, 7d o month.', 'category metrics reject unsupported periods');
select throws_ok($$select private.metrics_alerts_at('20000000-0000-0000-0000-000000000030', null)$$, '22004', 'La fecha de referencia es obligatoria.', 'alert helper requires its explicit clock');

set local role authenticated;
select throws_ok($$select public.metrics_daily('20000000-0000-0000-0000-000000000010', 14)$$, '42501', 'No tienes acceso a este negocio.', 'daily metrics reject another tenant');
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.metrics_alerts('20000000-0000-0000-0000-000000000030')$$, '42501', 'Debes iniciar sesión para consultar las métricas.', 'alerts reject a request without a user');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is(jsonb_typeof(public.metrics_products('20000000-0000-0000-0000-000000000030', 'month', 0, 6)), 'object', 'the public product RPC returns a JSON object');

select * from finish();
rollback;
