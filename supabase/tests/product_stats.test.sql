begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

-- Casos borde que el seed no cubre: sin precio, por debajo del costo, justo en
-- el umbral del margen estrecho y con stock negativo.
insert into public.product (
  id, business_id, name, sku, category_id, supplier_id, cost, price, stock, min_stock
) values
  ('55000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Muestra sin precio', 'EDGE-01', null, null, 1000, 0, 5, 0),
  ('55000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Obsequio sin valor', 'EDGE-02', null, null, 0, 0, 5, 0),
  ('55000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Liquidación bajo costo', 'EDGE-03', null, null, 12000, 10000, 5, 0),
  ('55000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Margen exacto', 'EDGE-04', null, null, 8000, 10000, 5, 0),
  ('55000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Margen al filo', 'EDGE-05', null, null, 8001, 10000, 5, 0),
  ('55000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'Sobrevendido', 'EDGE-06', null, null, 5000, 9000, -3, 0);

-- Producto de un negocio ajeno para comprobar el aislamiento.
insert into public.product (
  id, business_id, name, sku, cost, price, stock, min_stock
) values
  ('56000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010', 'Producto Ajeno', 'AJE-001', 1000, 2000, 1, 0);

select ok(
  (select 'security_invoker=true' = any(c.reloptions)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'v_product_stats'),
  'the view declares security_invoker so product RLS applies to the caller'
);

select ok(
  not has_table_privilege('anon', 'public.v_product_stats', 'select'),
  'anon cannot read the view'
);

select ok(
  has_table_privilege('authenticated', 'public.v_product_stats', 'select'),
  'authenticated can read the view'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Cálculos sobre un producto del seed.
select is(
  (select margin_amount from public.v_product_stats where sku = 'PER-001'),
  31000::bigint,
  'margin_amount is price minus cost'
);

select is(
  (select margin_pct from public.v_product_stats where sku = 'PER-001'),
  39.24::numeric,
  'margin_pct is the gross margin rounded to two decimals'
);

select is(
  (select inventory_value from public.v_product_stats where sku = 'PER-001'),
  576000::bigint,
  'inventory_value is cost times stock'
);

select is(
  (select retail_value from public.v_product_stats where sku = 'PER-001'),
  948000::bigint,
  'retail_value is price times stock'
);

select is(
  (select category_name from public.v_product_stats where sku = 'PER-001'),
  'Perfumería',
  'the view resolves the category name'
);

select is(
  (select supplier_name from public.v_product_stats where sku = 'PER-001'),
  'Distribuciones Central',
  'the view resolves the supplier name'
);

select ok(
  (select category_name is null and supplier_name is null
   from public.v_product_stats where sku = 'EDGE-01'),
  'a product without category or supplier still appears'
);

-- Margen indefinido y márgenes estrechos.
select ok(
  (select margin_pct is null from public.v_product_stats where sku = 'EDGE-01'),
  'margin_pct is null when the price is zero'
);

select ok(
  (select is_thin_margin from public.v_product_stats where sku = 'EDGE-01'),
  'a product with cost and no price counts as thin margin'
);

select ok(
  (select margin_pct is null from public.v_product_stats where sku = 'EDGE-02'),
  'margin_pct is null when cost and price are zero'
);

select ok(
  (select not is_thin_margin from public.v_product_stats where sku = 'EDGE-02'),
  'a product with no cost and no price is not thin margin'
);

select is(
  (select margin_pct from public.v_product_stats where sku = 'EDGE-03'),
  -20.00::numeric,
  'selling below cost yields a negative margin'
);

select ok(
  (select is_thin_margin from public.v_product_stats where sku = 'EDGE-03'),
  'a negative margin is always thin'
);

select is(
  (select margin_pct from public.v_product_stats where sku = 'EDGE-04'),
  20.00::numeric,
  'the threshold product sits exactly at twenty percent'
);

select ok(
  (select not is_thin_margin from public.v_product_stats where sku = 'EDGE-04'),
  'exactly twenty percent is not thin margin'
);

select is(
  (select margin_pct from public.v_product_stats where sku = 'EDGE-05'),
  19.99::numeric,
  'the margin just below the threshold is reported'
);

select ok(
  (select is_thin_margin from public.v_product_stats where sku = 'EDGE-05'),
  'just below twenty percent is thin margin'
);

-- Stock bajo, comparación estricta.
select ok(
  (select is_low_stock from public.v_product_stats where sku = 'CUI-002'),
  'stock below the minimum is flagged'
);

select ok(
  (select is_low_stock from public.v_product_stats where sku = 'ACC-003'),
  'a second product below the minimum is flagged'
);

select ok(
  (select not is_low_stock from public.v_product_stats where sku = 'ACC-001'),
  'stock equal to the minimum is not low'
);

select ok(
  (select is_low_stock from public.v_product_stats where sku = 'EDGE-06'),
  'negative stock is low'
);

select is(
  (select inventory_value from public.v_product_stats where sku = 'EDGE-06'),
  -15000::bigint,
  'negative stock produces a negative inventory value'
);

-- Filtros que consumirá el inventario desde PostgREST.
select results_eq(
  $$select sku from public.v_product_stats where is_low_stock order by sku$$,
  $$values ('ACC-003'::text), ('CUI-002'), ('EDGE-06')$$,
  'the low stock filter returns only products below the minimum'
);

select results_eq(
  $$select sku from public.v_product_stats where is_thin_margin order by sku$$,
  $$values ('ACC-004'::text), ('EDGE-01'), ('EDGE-03'), ('EDGE-05')$$,
  'the thin margin filter returns only products under twenty percent'
);

select results_eq(
  $$select sku from public.v_product_stats
    where name ilike '%perfume%' or sku ilike '%perfume%'
    order by sku$$,
  $$values ('PER-001'::text), ('PER-002')$$,
  'the search filter matches the product name'
);

select results_eq(
  $$select sku from public.v_product_stats
    where name ilike '%acc-%' or sku ilike '%acc-%'
    order by sku$$,
  $$values ('ACC-001'::text), ('ACC-002'), ('ACC-003'), ('ACC-004')$$,
  'the search filter matches the sku'
);

select results_eq(
  $$select sku from public.v_product_stats
    where category_id = '30000000-0000-0000-0000-000000000003'
    order by sku$$,
  $$values ('ACC-001'::text), ('ACC-002'), ('ACC-003'), ('ACC-004')$$,
  'the category filter returns that category only'
);

select results_eq(
  $$select sku from public.v_product_stats
    where supplier_id = '40000000-0000-0000-0000-000000000001'
    order by sku$$,
  $$values ('ACC-001'::text), ('ACC-002'), ('ACC-004'), ('PER-001'), ('PER-002')$$,
  'the supplier filter returns that supplier only'
);

select results_eq(
  $$select sku from public.v_product_stats
    where is_low_stock and category_id = '30000000-0000-0000-0000-000000000003'
    order by sku$$,
  $$values ('ACC-003'::text)$$,
  'low stock combines with the category filter'
);

select results_eq(
  $$select sku from public.v_product_stats
    where is_thin_margin and (name ilike '%bolsa%' or sku ilike '%bolsa%')
    order by sku$$,
  $$values ('ACC-004'::text)$$,
  'thin margin combines with the search filter'
);

select results_eq(
  $$select sku from public.v_product_stats where active order by sku limit 3$$,
  $$values ('ACC-001'::text), ('ACC-002'), ('ACC-003')$$,
  'the active filter and ordering work on the view'
);

-- Aislamiento entre negocios.
select is(
  (select count(*) from public.v_product_stats),
  15::bigint,
  'the owner sees every product of their business'
);

select is(
  (select count(*) from public.v_product_stats
   where business_id <> '20000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the owner sees no product from another business'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is(
  (select count(*) from public.v_product_stats),
  1::bigint,
  'another user only sees the product of their own business'
);

select is(
  (select count(*) from public.v_product_stats
   where business_id = '20000000-0000-0000-0000-000000000001'),
  0::bigint,
  'another user sees nothing from the demo business'
);

select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*) from public.v_product_stats),
  0::bigint,
  'a request without a user sees nothing'
);

select * from finish();
rollback;
