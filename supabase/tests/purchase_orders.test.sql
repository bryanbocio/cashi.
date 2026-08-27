begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

-- Fixtures de otro tenant creados antes de adoptar el rol autenticado.
insert into public.product (id, business_id, name, sku, cost, price, stock, min_stock)
values (
  '56000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000010',
  'Producto ajeno de compras', 'PO-AJENO-1', 100, 200, 4, 1
);

insert into public.supplier (id, business_id, name)
values (
  '46000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000010',
  'Proveedor ajeno de compras'
);

insert into public.purchase_order (id, business_id, code)
values (
  '92300000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000010',
  'OC-AJENA-1'
);

select ok(
  not has_function_privilege('anon', 'public.receive_purchase_order(uuid)', 'execute'),
  'anon cannot receive purchase orders'
);

select ok(
  has_function_privilege('authenticated', 'public.receive_purchase_order(uuid)', 'execute'),
  'authenticated can receive purchase orders'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.next_doc_code('20000000-0000-0000-0000-000000000001', 'PURCHASE'),
  'OC-0001',
  'purchase orders receive a readable sequential code'
);

-- CRUD de un borrador.
select lives_ok(
  $$insert into public.purchase_order (id, business_id, code, supplier_id, expected_at)
    values (
      '92000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'OC-TEST-0001',
      '40000000-0000-0000-0000-000000000001',
      current_date + 7
    )$$,
  'a member can create a pending order'
);

select is(
  (select status::text from public.purchase_order where id = '92000000-0000-0000-0000-000000000001'),
  'PENDING',
  'a new order starts pending'
);

select lives_ok(
  $$insert into public.purchase_line (id, purchase_order_id, product_id, qty, unit_cost)
    values (
      '92100000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001', 3, 51000
    ), (
      '92100000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000003', 2, 20000
    )$$,
  'a member can add products to a pending order'
);

select results_eq(
  $$update public.purchase_order
    set expected_at = current_date + 10
    where id = '92000000-0000-0000-0000-000000000001'
    returning expected_at$$,
  $$values (current_date + 10)$$,
  'a member can update an order draft'
);

select results_eq(
  $$update public.purchase_line
    set qty = 4
    where id = '92100000-0000-0000-0000-000000000001'
    returning qty$$,
  $$values (4)$$,
  'a member can update a line in a pending order'
);

-- La recepción aplica costo y existencias.
select lives_ok(
  $$select public.receive_purchase_order('92000000-0000-0000-0000-000000000001')$$,
  'a pending order can be received'
);

select is(
  (select status::text from public.purchase_order where id = '92000000-0000-0000-0000-000000000001'),
  'RECEIVED',
  'receiving marks the order as received'
);

select ok(
  (select received_at is not null from public.purchase_order where id = '92000000-0000-0000-0000-000000000001'),
  'receiving stores its timestamp'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000001'),
  16,
  'receiving adds the first product quantity'
);

select is(
  (select cost from public.product where id = '50000000-0000-0000-0000-000000000001'),
  51000::bigint,
  'the purchase cost becomes the current product cost'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000003'),
  20,
  'receiving adds the second product quantity'
);

select is(
  (select cost from public.product where id = '50000000-0000-0000-0000-000000000003'),
  20000::bigint,
  'the second product also receives its purchase cost'
);

select is(
  (select count(*) from public.stock_movement where ref_id = '92000000-0000-0000-0000-000000000001' and type = 'PURCHASE'),
  2::bigint,
  'receiving writes one movement per product'
);

select is(
  (select sum(qty_delta)::integer from public.stock_movement where ref_id = '92000000-0000-0000-0000-000000000001' and type = 'PURCHASE'),
  6,
  'purchase movements add up to the received units'
);

select is(
  (select count(*) from public.stock_movement
   where ref_id = '92000000-0000-0000-0000-000000000001'
     and ref_table = 'purchase_order'
     and business_id = '20000000-0000-0000-0000-000000000001'),
  2::bigint,
  'movements keep the order reference and tenant'
);

-- Idempotencia secuencial.
select lives_ok(
  $$select public.receive_purchase_order('92000000-0000-0000-0000-000000000001')$$,
  'receiving the same order twice is harmless'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000001'),
  16,
  'the second reception does not duplicate stock'
);

select is(
  (select count(*) from public.stock_movement where ref_id = '92000000-0000-0000-0000-000000000001'),
  2::bigint,
  'the second reception does not duplicate movements'
);

-- Un documento recibido queda inmutable desde el CRUD directo.
select is_empty(
  $$update public.purchase_order set expected_at = current_date + 20
    where id = '92000000-0000-0000-0000-000000000001' returning id$$,
  'a received order cannot be edited directly'
);

select is_empty(
  $$update public.purchase_line set qty = 99
    where id = '92100000-0000-0000-0000-000000000001' returning id$$,
  'a received line cannot be edited directly'
);

select is_empty(
  $$delete from public.purchase_order
    where id = '92000000-0000-0000-0000-000000000001' returning id$$,
  'a received order cannot be deleted directly'
);

-- Estados y datos inválidos.
insert into public.purchase_order (id, business_id, code)
values
  ('92000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'OC-TEST-0002'),
  ('92000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'OC-TEST-0003');

update public.purchase_order set status = 'CANCELLED'
where id = '92000000-0000-0000-0000-000000000002';

select throws_ok(
  $$select public.receive_purchase_order('92000000-0000-0000-0000-000000000002')$$,
  '22023',
  'Una orden cancelada no se puede recibir.',
  'a cancelled order cannot be received'
);

select throws_ok(
  $$select public.receive_purchase_order('92000000-0000-0000-0000-000000000003')$$,
  '22023',
  'La orden necesita al menos un producto.',
  'an empty order cannot be received'
);

select throws_ok(
  $$insert into public.purchase_order (business_id, code, status, received_at)
    values ('20000000-0000-0000-0000-000000000001', 'OC-BYPASS-1', 'RECEIVED', current_timestamp)$$,
  '42501',
  null,
  'a member cannot insert an already received order'
);

select throws_ok(
  $$insert into public.purchase_order (business_id, code, supplier_id)
    values (
      '20000000-0000-0000-0000-000000000001',
      'OC-BYPASS-2',
      '46000000-0000-0000-0000-000000000002'
    )$$,
  '42501',
  null,
  'an order cannot reference a supplier from another business'
);

select throws_ok(
  $$update public.purchase_order set status = 'RECEIVED'
    where id = '92000000-0000-0000-0000-000000000003'$$,
  '42501',
  null,
  'a member cannot mark an order received without the RPC'
);

select throws_ok(
  $$insert into public.purchase_line (purchase_order_id, product_id, qty, unit_cost)
    values (
      '92000000-0000-0000-0000-000000000003',
      '56000000-0000-0000-0000-000000000002', 1, 1
    )$$,
  '42501',
  null,
  'a line cannot reference a product from another business'
);

select throws_ok(
  $$select public.receive_purchase_order('92900000-0000-0000-0000-000000000099')$$,
  'P0002',
  'La orden de compra no existe.',
  'a missing order is rejected'
);

select throws_ok(
  $$select public.receive_purchase_order('92300000-0000-0000-0000-000000000010')$$,
  '42501',
  'No tienes acceso a este negocio.',
  'an order from another business is rejected'
);

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.receive_purchase_order('92000000-0000-0000-0000-000000000003')$$,
  '42501',
  'Debes iniciar sesión para recibir una orden de compra.',
  'a request without a user is rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

-- El borrado sigue disponible para borradores y órdenes canceladas.
select results_eq(
  $$delete from public.purchase_order
    where id = '92000000-0000-0000-0000-000000000003' returning id$$,
  $$values ('92000000-0000-0000-0000-000000000003'::uuid)$$,
  'a pending order can be deleted'
);

select results_eq(
  $$delete from public.purchase_order
    where id = '92000000-0000-0000-0000-000000000002' returning id$$,
  $$values ('92000000-0000-0000-0000-000000000002'::uuid)$$,
  'a cancelled order can be deleted'
);

select * from finish();
rollback;
