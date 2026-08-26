begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.product (
  id, business_id, name, sku, cost, price, stock, min_stock, active
) values
  ('57000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Resumen activo', 'SUMMARY-01', 111, 222, 7, 0, true),
  ('57000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Resumen inactivo', 'SUMMARY-02', 999999, 999999, 50, 0, false),
  ('57000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010', 'Resumen ajeno', 'SUMMARY-03', 333, 444, 3, 0, true);

select ok(
  (select 'security_invoker=true' = any(c.reloptions)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'v_inventory_summary'),
  'the summary view uses the caller permissions'
);

select ok(
  not has_table_privilege('anon', 'public.v_inventory_summary', 'select'),
  'anon cannot read the inventory summary'
);

select ok(
  has_table_privilege('authenticated', 'public.v_inventory_summary', 'select'),
  'authenticated can read the inventory summary'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select product_count from public.v_inventory_summary),
  10::bigint,
  'the summary counts every active product and excludes inactive products'
);

select is(
  (select stock_units from public.v_inventory_summary),
  112::bigint,
  'the summary adds stock units across the full active catalog'
);

select is(
  (select inventory_value from public.v_inventory_summary),
  1911277::bigint,
  'inventory value is the complete cost times stock total'
);

select is(
  (select retail_value from public.v_inventory_summary),
  3229554::bigint,
  'retail value is the complete price times stock total'
);

select is(
  (select count(*) from public.v_inventory_summary
   where business_id <> '20000000-0000-0000-0000-000000000001'),
  0::bigint,
  'the owner cannot see another business summary'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is(
  (select inventory_value from public.v_inventory_summary),
  999::bigint,
  'another member sees only their own inventory value'
);

select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*) from public.v_inventory_summary),
  0::bigint,
  'a request without a user sees no inventory summary'
);

select * from finish();
rollback;
