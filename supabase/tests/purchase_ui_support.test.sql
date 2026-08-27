begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

select ok(
  not has_table_privilege('anon', 'public.v_purchase_orders', 'select'),
  'anon cannot read the purchase order view'
);

select ok(
  has_table_privilege('authenticated', 'public.v_purchase_orders', 'select'),
  'authenticated can read the purchase order view'
);

select ok(
  not has_function_privilege('anon', 'public.create_suggested_purchase_order(uuid)', 'execute'),
  'anon cannot create a suggested order'
);

select ok(
  has_function_privilege('authenticated', 'public.create_suggested_purchase_order(uuid)', 'execute'),
  'authenticated can create a suggested order'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.v_purchase_orders),
  0::bigint,
  'the demo starts without purchase orders'
);

select is(
  public.create_suggested_purchase_order('20000000-0000-0000-0000-000000000001') ->> 'code',
  'OC-0001',
  'the suggested order receives the next readable code'
);

select is(
  (select status::text from public.purchase_order where code = 'OC-0001'),
  'PENDING',
  'the suggested order is pending'
);

select ok(
  (select supplier_id is null from public.purchase_order where code = 'OC-0001'),
  'the mixed suggested order has no single supplier id'
);

select is(
  (select count(*) from public.purchase_line
   where purchase_order_id = (select id from public.purchase_order where code = 'OC-0001')),
  2::bigint,
  'the order stores one line per suggested product'
);

select is(
  (select qty from public.purchase_line pl
   join public.product p on p.id = pl.product_id
   where pl.purchase_order_id = (select id from public.purchase_order where code = 'OC-0001')
     and p.sku = 'CUI-002'),
  7,
  'the first line keeps its suggested quantity'
);

select is(
  (select qty from public.purchase_line pl
   join public.product p on p.id = pl.product_id
   where pl.purchase_order_id = (select id from public.purchase_order where code = 'OC-0001')
     and p.sku = 'ACC-003'),
  6,
  'the second line keeps its suggested quantity'
);

select is(
  (select total_cost from public.v_purchase_orders where code = 'OC-0001'),
  108500::bigint,
  'the view calculates the order cost from frozen line costs'
);

select is(
  (select stock from public.product where sku = 'CUI-002'),
  3,
  'creating an order does not change stock'
);

select is(
  (select count(*) from public.stock_movement
   where ref_id = (select id from public.purchase_order where code = 'OC-0001')),
  0::bigint,
  'creating an order writes no stock movement'
);

select is(
  (select supplier_name from public.v_purchase_orders where code = 'OC-0001'),
  'Varios proveedores',
  'the view labels an order without one supplier as mixed'
);

select results_eq(
  $$select line_count, total_units, total_cost
    from public.v_purchase_orders where code = 'OC-0001'$$,
  $$values (2, 13::bigint, 108500::bigint)$$,
  'the view exposes line, unit and cost totals'
);

select throws_ok(
  $$select public.create_suggested_purchase_order('20000000-0000-0000-0000-000000000010')$$,
  '42501',
  'No tienes acceso a este negocio.',
  'a member cannot create an order in another business'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is(
  (select count(*) from public.v_purchase_orders),
  0::bigint,
  'another owner cannot see the demo order'
);

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.create_suggested_purchase_order('20000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Debes iniciar sesión para crear una orden de compra.',
  'a request without a user is rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select public.adjust_stock('50000000-0000-0000-0000-000000000004', 2, 'Fixture sin faltantes');
select public.adjust_stock('50000000-0000-0000-0000-000000000008', 2, 'Fixture sin faltantes');

select throws_ok(
  $$select public.create_suggested_purchase_order('20000000-0000-0000-0000-000000000001')$$,
  '22023',
  'No hay productos por reponer.',
  'no order is created when every product is at or above minimum'
);

select is(
  (select count(*) from public.purchase_order where code like 'OC-%'),
  1::bigint,
  'the rejected empty suggestion leaves no order'
);

select * from finish();
rollback;
