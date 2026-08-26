begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (select 'security_invoker=true' = any(c.reloptions)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'v_sale_detail'),
  'the sale view declares security_invoker'
);

select ok(
  not has_table_privilege('anon', 'public.v_sale_detail', 'select'),
  'anon cannot read the sale view'
);

-- PER-001: 48000 / 79000, stock 12. CUI-001: 18000 / 32000, stock 18.
select public.create_sale(
  '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'CREDIT', 9000, '2026-09-30',
  '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":2},
    {"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb
);

-- Detalle: subtotal 158000 + 32000 = 190000, descuento 9000, total 181000.
-- Ganancia 62000 + 14000 = 76000, menos el descuento = 67000.
select results_eq(
  $$select subtotal, discount, total, gross_profit, line_count, items
    from public.v_sale_detail where code = 'FAC-00001'$$,
  $$values (190000::bigint, 9000::bigint, 181000::bigint, 67000::bigint, 2, 3)$$,
  'the view computes subtotal, total, profit and the line summary'
);

select is(
  (select customer_name from public.v_sale_detail where code = 'FAC-00001'),
  'Ana Pérez',
  'the view resolves the customer name'
);

select is(
  (select payment_method::text from public.v_sale_detail where code = 'FAC-00001'),
  'CREDIT',
  'the view exposes the payment method'
);

select is(
  (select due_date from public.v_sale_detail where code = 'FAC-00001'),
  '2026-09-30'::date,
  'the view exposes the due date'
);

select is(
  (select status::text from public.v_sale_detail where code = 'FAC-00001'),
  'CONFIRMED',
  'a new sale is confirmed'
);

select public.create_sale(
  '20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000005","qty":1}]'::jsonb
);

select ok(
  (select customer_name is null from public.v_sale_detail where code = 'FAC-00002'),
  'a sale without customer shows no name'
);

-- Anulación.
select is(
  (select stock from public.product where sku = 'PER-001'),
  10,
  'the stock is discounted before voiding'
);

select lives_ok(
  $$select public.void_sale((select id from public.sale where code = 'FAC-00001'))$$,
  'the sale can be voided'
);

select is(
  (select status::text from public.sale where code = 'FAC-00001'),
  'VOID',
  'the sale is marked as void'
);

select is(
  (select stock from public.product where sku = 'PER-001'),
  12,
  'voiding gives back the stock of the first product'
);

select is(
  (select stock from public.product where sku = 'CUI-001'),
  18,
  'voiding gives back the stock of the second product'
);

select is(
  (select count(*) from public.stock_movement
   where ref_id = (select id from public.sale where code = 'FAC-00001') and type = 'RETURN'),
  2::bigint,
  'voiding writes one RETURN movement per product'
);

select is(
  (select sum(qty_delta)::integer from public.stock_movement
   where ref_id = (select id from public.sale where code = 'FAC-00001') and type = 'RETURN'),
  3,
  'the RETURN movements add up to the quantity sold'
);

select is(
  (select sum(qty_delta)::integer from public.stock_movement
   where ref_id = (select id from public.sale where code = 'FAC-00001')),
  0,
  'the sale and return movements cancel each other out'
);

-- Idempotencia: anular de nuevo no puede devolver el stock otra vez.
select lives_ok(
  $$select public.void_sale((select id from public.sale where code = 'FAC-00001'))$$,
  'voiding twice does not fail'
);

select is(
  (select stock from public.product where sku = 'PER-001'),
  12,
  'voiding twice does not give back the stock twice'
);

select is(
  (select count(*) from public.stock_movement
   where ref_id = (select id from public.sale where code = 'FAC-00001') and type = 'RETURN'),
  2::bigint,
  'voiding twice does not duplicate the movements'
);

select is(
  (select status::text from public.v_sale_detail where code = 'FAC-00001'),
  'VOID',
  'the view reports the sale as void'
);

-- Una venta anulada conserva sus cifras; filtrar por estado es tarea de quien consulta.
select is(
  (select gross_profit from public.v_sale_detail where code = 'FAC-00001'),
  67000::bigint,
  'a void sale keeps its numbers for the record'
);

select is(
  (select count(*) from public.v_sale_detail
   where business_id = '20000000-0000-0000-0000-000000000001' and status = 'CONFIRMED'),
  1::bigint,
  'filtering by status leaves only the live sale'
);

-- Validaciones y aislamiento.
select throws_ok(
  $$select public.void_sale('59000000-0000-0000-0000-000000000099')$$,
  'P0002',
  'La venta no existe.',
  'voiding a missing sale is rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is(
  (select count(*) from public.v_sale_detail),
  0::bigint,
  'another user sees no sale from the demo business'
);

select throws_ok(
  $$select public.void_sale((select id from public.sale where code = 'FAC-00002'))$$,
  'P0002',
  'La venta no existe.',
  'another user cannot even name a sale of the demo business'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*) from public.v_sale_detail where business_id = '20000000-0000-0000-0000-000000000001'),
  2::bigint,
  'the owner still sees both sales'
);

select * from finish();
rollback;
