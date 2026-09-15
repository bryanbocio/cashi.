begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into public.supplier (id, business_id, name)
values ('49000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', 'Proveedor ajeno manual');

insert into public.product (id, business_id, name, sku, cost, price, stock, min_stock)
values ('59000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', 'Producto ajeno manual', 'MAN-AJENO', 100, 200, 1, 0);

select ok(
  not has_function_privilege('anon', 'public.create_purchase_order(uuid,uuid,date,boolean,jsonb)', 'execute'),
  'anon cannot create a manual purchase'
);

select ok(
  has_function_privilege('authenticated', 'public.create_purchase_order(uuid,uuid,date,boolean,jsonb)', 'execute'),
  'authenticated can create a manual purchase'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.create_purchase_order(
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    current_date + 3,
    false,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":2,"unit_cost":49000}]'
  ) ->> 'code',
  'OC-0001',
  'a manual purchase receives a readable code'
);

select is(
  (select status::text from public.purchase_order where code = 'OC-0001'),
  'PENDING',
  'saving for later leaves the purchase pending'
);

select results_eq(
  $$select total_units, total_cost from public.v_purchase_orders where code = 'OC-0001'$$,
  $$values (2::bigint, 98000::bigint)$$,
  'the pending purchase stores its units and total'
);

select is(
  (select stock from public.product where sku = 'PER-001'),
  12,
  'a pending manual purchase does not change stock'
);

select is(
  public.create_purchase_order(
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    null,
    true,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":3,"unit_cost":50000}]'
  ) ->> 'status',
  'RECEIVED',
  'a purchase can be created and received atomically'
);

select is((select stock from public.product where sku = 'PER-001'), 15, 'receiving adds the purchased units');
select is((select cost from public.product where sku = 'PER-001'), 50000::bigint, 'receiving applies the new unit cost');

select is(
  (select count(*) from public.stock_movement where ref_id = (select id from public.purchase_order where code = 'OC-0002')),
  1::bigint,
  'receiving writes one audited stock movement'
);

select is(
  (select total_cost from public.v_purchase_orders where code = 'OC-0002'),
  150000::bigint,
  'the received purchase exposes the exact total'
);

select is(
  (select supplier_name from public.v_purchase_orders where code = 'OC-0002'),
  'Distribuciones Central',
  'the selected supplier is visible on the purchase'
);

select throws_ok(
  $$select public.create_purchase_order('20000000-0000-0000-0000-000000000001', '49000000-0000-0000-0000-000000000010', null, false, '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1,"unit_cost":1}]')$$,
  '22023',
  'El proveedor no pertenece a este negocio.',
  'a supplier from another business is rejected'
);

select throws_ok(
  $$select public.create_purchase_order('20000000-0000-0000-0000-000000000001', null, null, false, '[{"product_id":"59000000-0000-0000-0000-000000000010","qty":1,"unit_cost":1}]')$$,
  '22023',
  'La compra contiene un producto inexistente o inactivo.',
  'a product from another business is rejected'
);

select throws_ok(
  $$select public.create_purchase_order('20000000-0000-0000-0000-000000000001', null, null, false, '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1,"unit_cost":1},{"product_id":"50000000-0000-0000-0000-000000000001","qty":2,"unit_cost":1}]')$$,
  '22023',
  'No repitas un producto dentro de la misma compra.',
  'duplicate products are rejected'
);

select throws_ok(
  $$select public.create_purchase_order('20000000-0000-0000-0000-000000000001', null, null, false, '[]')$$,
  '22023',
  'Agrega al menos un producto a la compra.',
  'an empty purchase is rejected'
);

select throws_ok(
  $$select public.create_purchase_order('20000000-0000-0000-0000-000000000001', null, null, false, '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":0,"unit_cost":1}]')$$,
  '22023',
  'La cantidad debe ser mayor que cero y el costo no puede ser negativo.',
  'a zero quantity is rejected'
);

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.create_purchase_order('20000000-0000-0000-0000-000000000001', null, null, false, '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1,"unit_cost":1}]')$$,
  '42501',
  'Debes iniciar sesión para registrar una compra.',
  'a request without a user is rejected'
);

select * from finish();
rollback;
