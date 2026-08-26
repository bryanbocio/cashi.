begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- PER-001: costo 48000, precio 79000, stock 12. CUI-001: 18000 / 32000, stock 18.
select is(
  (select public.create_sale(
    '20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":2}]'::jsonb
  ) ->> 'code'),
  'FAC-00001',
  'the sale gets a readable code'
);

select is(
  (select total from public.sale where code = 'FAC-00001'),
  158000::bigint,
  'the total is quantity times current price'
);

select is(
  (select stock from public.product where sku = 'PER-001'),
  10,
  'the stock goes down by the quantity sold'
);

select is(
  (select qty_delta from public.stock_movement
   where ref_id = (select id from public.sale where code = 'FAC-00001')),
  -2,
  'the sale writes a negative movement'
);

select is(
  (select type::text from public.stock_movement
   where ref_id = (select id from public.sale where code = 'FAC-00001')),
  'SALE',
  'the movement is of type SALE'
);

select results_eq(
  $$select name_snapshot, unit_price, unit_cost, category_snapshot
    from public.sale_line
    where sale_id = (select id from public.sale where code = 'FAC-00001')$$,
  $$values ('Perfume Aurora 50 ml'::text, 79000::bigint, 48000::bigint, 'Perfumería'::text)$$,
  'the line freezes name, price, cost and category'
);

-- Regla central: cambiar el costo después no puede tocar la ganancia histórica.
select public.adjust_stock('50000000-0000-0000-0000-000000000001', 1, 'Ajuste previo al cambio de costo');
update public.product set cost = 70000, price = 90000 where sku = 'PER-001';

select is(
  (select unit_cost from public.sale_line
   where sale_id = (select id from public.sale where code = 'FAC-00001')),
  48000::bigint,
  'changing the product cost does not touch the sold line'
);

select is(
  (select unit_price from public.sale_line
   where sale_id = (select id from public.sale where code = 'FAC-00001')),
  79000::bigint,
  'changing the product price does not touch the sold line'
);

select is(
  (select sum(l.qty * (l.unit_price - l.unit_cost))::bigint from public.sale_line l
   where l.sale_id = (select id from public.sale where code = 'FAC-00001')),
  62000::bigint,
  'the historic profit of the sale stays the same'
);

-- Ganancia devuelta y descuento.
select is(
  (select public.create_sale(
    '20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":3}]'::jsonb
  ) ->> 'gross_profit')::bigint,
  42000::bigint,
  'the payload returns the gross profit of the sale'
);

select is(
  (select public.create_sale(
    '20000000-0000-0000-0000-000000000001', null, 'CASH', 10000, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":3}]'::jsonb
  ) ->> 'gross_profit')::bigint,
  32000::bigint,
  'the discount comes out of the profit'
);

select is(
  (select total from public.sale where code = 'FAC-00003'),
  86000::bigint,
  'the discount comes off the total'
);

select is(
  (select discount from public.sale where code = 'FAC-00003'),
  10000::bigint,
  'the discount is stored on the sale'
);

-- Varias líneas y líneas repetidas del mismo producto.
select is(
  (select jsonb_array_length(public.create_sale(
    '20000000-0000-0000-0000-000000000001', null, 'TRANSFER', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000005","qty":1},
      {"product_id":"50000000-0000-0000-0000-000000000007","qty":2},
      {"product_id":"50000000-0000-0000-0000-000000000005","qty":3}]'::jsonb
  ) -> 'lines')),
  2,
  'repeated products are merged into a single line'
);

select is(
  (select qty from public.sale_line
   where sale_id = (select id from public.sale where code = 'FAC-00004')
     and product_id = '50000000-0000-0000-0000-000000000005'),
  4,
  'the merged line adds up the quantities'
);

select is(
  (select stock from public.product where sku = 'CUI-003'),
  16,
  'the merged quantity is discounted once from the stock'
);

-- Fiado.
select is(
  (select public.create_sale(
    '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'CREDIT', 0, '2026-09-30',
    '[{"product_id":"50000000-0000-0000-0000-000000000006","qty":1}]'::jsonb
  ) ->> 'due_date'),
  '2026-09-30',
  'a credit sale keeps its due date'
);

select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000001', null, 'CREDIT', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000006","qty":1}]'::jsonb)$$,
  '22023',
  'Una venta a crédito necesita un cliente.',
  'credit without a customer is rejected'
);

select ok(
  (select (public.create_sale(
    '20000000-0000-0000-0000-000000000001', null, 'CASH', 0, '2026-09-30',
    '[{"product_id":"50000000-0000-0000-0000-000000000006","qty":1}]'::jsonb
  ) ->> 'due_date') is null),
  'a cash sale ignores the due date'
);

-- Vender sin existencias está permitido y deja el stock negativo.
select is(
  (select public.create_sale(
    '20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000008","qty":5}]'::jsonb
  ) ->> 'total')::bigint,
  65000::bigint,
  'selling without enough stock is allowed'
);

select is(
  (select stock from public.product where sku = 'ACC-003'),
  -3,
  'the stock may end up negative'
);

-- Validaciones.
select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000001', null, 'EFECTIVO', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1}]'::jsonb)$$,
  '22023',
  'El método de pago no es válido.',
  'an unknown payment method is rejected'
);

select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null, '[]'::jsonb)$$,
  '22023',
  'La venta necesita al menos un producto.',
  'a sale without lines is rejected'
);

select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":0}]'::jsonb)$$,
  '22023',
  'Cada línea debe llevar una cantidad mayor que cero.',
  'a line with quantity zero is rejected'
);

select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000001', null, 'CASH', -5, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1}]'::jsonb)$$,
  '22023',
  'El descuento no puede ser negativo.',
  'a negative discount is rejected'
);

select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000001', null, 'CASH', 999999999, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1}]'::jsonb)$$,
  '22023',
  'El descuento no puede superar el total de la venta.',
  'a discount larger than the sale is rejected'
);

select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
    '[{"product_id":"59000000-0000-0000-0000-000000000099","qty":1}]'::jsonb)$$,
  'P0002',
  'Algún producto de la venta no existe o no está disponible en este negocio.',
  'a product from outside the business is rejected'
);

select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000099', 'CASH', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1}]'::jsonb)$$,
  'P0002',
  'El cliente no existe en este negocio.',
  'a customer from outside the business is rejected'
);

select throws_ok(
  $$select public.create_sale('20000000-0000-0000-0000-000000000010', null, 'CASH', 0, null,
    '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1}]'::jsonb)$$,
  '42501',
  'No tienes acceso a este negocio.',
  'selling into another business is rejected'
);

-- Una venta rechazada no deja rastro: ni stock movido ni código consumido.
select is(
  (select stock from public.product where sku = 'PER-001'),
  11,
  'a rejected sale leaves the stock untouched'
);

select is(
  (select count(*) from public.sale
   where business_id = '20000000-0000-0000-0000-000000000001'
     and code like 'FAC-%'),
  7::bigint,
  'only the accepted sales were stored'
);

select * from finish();
rollback;
