begin;

create extension if not exists pgtap with schema extensions;
select plan(51);

-- Fixtures ajenos creados como postgres para probar aislamiento y validaciones.
insert into public.product (id, business_id, name, sku, cost, price, stock, min_stock)
values (
  '57000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000010',
  'Producto ajeno de cotizaciones', 'QUOTE-AJENO-1', 100, 250, 9, 1
);

insert into public.customer (id, business_id, name)
values (
  '67000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000010',
  'Cliente ajeno de cotizaciones'
);

insert into public.quote (
  id, business_id, code, customer_id, valid_until, status, total
) values (
  '77000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000010',
  'COT-AJENA-1',
  '67000000-0000-0000-0000-000000000010',
  current_date + 5, 'OPEN', 250
);

insert into public.quote_line (
  id, quote_id, product_id, name_snapshot, qty, unit_price, unit_cost
) values (
  '77100000-0000-0000-0000-000000000010',
  '77000000-0000-0000-0000-000000000010',
  '57000000-0000-0000-0000-000000000010',
  'Producto ajeno de cotizaciones', 1, 250, 100
);

select ok(
  not has_function_privilege('anon', 'public.create_quote(uuid,uuid,jsonb,date)', 'execute'),
  'anon cannot create quotes'
);

select ok(
  has_function_privilege('authenticated', 'public.create_quote(uuid,uuid,jsonb,date)', 'execute'),
  'authenticated can create quotes'
);

select ok(
  not has_table_privilege('anon', 'public.v_quote_detail', 'select'),
  'anon cannot read the quote list'
);

select ok(
  has_table_privilege('authenticated', 'public.v_quote_detail', 'select'),
  'authenticated can read the quote list'
);

select ok(
  not has_table_privilege('anon', 'public.v_quote_line_detail', 'select'),
  'anon cannot read quote line details'
);

select ok(
  has_table_privilege('authenticated', 'public.v_quote_line_detail', 'select'),
  'authenticated can read quote line details'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table created_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000003',
  '[
    {"product_id":"50000000-0000-0000-0000-000000000001","qty":2},
    {"product_id":"50000000-0000-0000-0000-000000000003","qty":2},
    {"product_id":"50000000-0000-0000-0000-000000000001","qty":1}
  ]'::jsonb,
  '2026-09-30'
) as payload;

select is(
  (select payload ->> 'code' from created_quote),
  'COT-0001',
  'a quote gets a readable sequential code'
);

select is(
  (select payload ->> 'customer_name' from created_quote),
  'Diana Ruiz',
  'the response includes the customer name'
);

select is(
  (select (payload ->> 'total')::bigint from created_quote),
  301000::bigint,
  'the response totals the frozen current prices'
);

select is(
  (select jsonb_array_length(payload -> 'lines') from created_quote),
  2,
  'repeated products are returned as one line'
);

select is(
  (select status::text from public.quote where code = 'COT-0001'),
  'OPEN',
  'a new quote starts open'
);

select is(
  (select valid_until from public.quote where code = 'COT-0001'),
  '2026-09-30'::date,
  'the validity date is stored exactly'
);

select is(
  (select total from public.quote where code = 'COT-0001'),
  301000::bigint,
  'the quote stores the calculated total'
);

select is(
  (select count(*) from public.quote_line
   where quote_id = (select id from public.quote where code = 'COT-0001')),
  2::bigint,
  'only one database line is stored per product'
);

select is(
  (select qty from public.quote_line
   where quote_id = (select id from public.quote where code = 'COT-0001')
     and product_id = '50000000-0000-0000-0000-000000000001'),
  3,
  'repeated quantities are added together'
);

select results_eq(
  $$select name_snapshot, qty, unit_price, unit_cost
    from public.quote_line
    where quote_id = (select id from public.quote where code = 'COT-0001')
    order by name_snapshot$$,
  $$values
    ('Crema corporal 250 ml'::text, 2, 32000::bigint, 18000::bigint),
    ('Perfume Aurora 50 ml'::text, 3, 79000::bigint, 48000::bigint)$$,
  'quote lines freeze name, quantity, price and cost'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000001'),
  12,
  'creating a quote does not reduce the first product stock'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000003'),
  18,
  'creating a quote does not reduce the second product stock'
);

select is(
  (select count(*) from public.stock_movement
   where ref_id = (select id from public.quote where code = 'COT-0001')),
  0::bigint,
  'creating a quote writes no stock movements'
);

select is(
  (select count(*) from public.sale
   where quote_id = (select id from public.quote where code = 'COT-0001')),
  0::bigint,
  'creating a quote does not create a sale'
);

select results_eq(
  $$select customer_name, line_count, total_units, total, gross_profit
    from public.v_quote_detail where code = 'COT-0001'$$,
  $$values ('Diana Ruiz'::text, 2, 5::bigint, 301000::bigint, 121000::bigint)$$,
  'the summary view exposes customer, counts, total and frozen profit'
);

select is(
  (select detail from public.v_quote_detail where code = 'COT-0001'),
  '2× Crema corporal 250 ml, 3× Perfume Aurora 50 ml',
  'the summary view exposes a readable line detail'
);

select results_eq(
  $$select name_snapshot, qty, line_total, line_profit
    from public.v_quote_line_detail where code = 'COT-0001'
    order by name_snapshot$$,
  $$values
    ('Crema corporal 250 ml'::text, 2, 64000::bigint, 28000::bigint),
    ('Perfume Aurora 50 ml'::text, 3, 237000::bigint, 93000::bigint)$$,
  'the line view calculates exact totals and profit'
);

update public.product
set price = 99000, cost = 74000
where id = '50000000-0000-0000-0000-000000000001';

select is(
  (select unit_price from public.quote_line
   where quote_id = (select id from public.quote where code = 'COT-0001')
     and product_id = '50000000-0000-0000-0000-000000000001'),
  79000::bigint,
  'changing the product price does not alter the quote snapshot'
);

select is(
  (select unit_cost from public.quote_line
   where quote_id = (select id from public.quote where code = 'COT-0001')
     and product_id = '50000000-0000-0000-0000-000000000001'),
  48000::bigint,
  'changing the product cost does not alter the quote snapshot'
);

select is(
  (select total from public.v_quote_detail where code = 'COT-0001'),
  301000::bigint,
  'the quote list keeps the original total after product edits'
);

select is(
  (select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb,
    current_date + 10
  ) ->> 'code'),
  'COT-0002',
  'a quote may be created without a customer'
);

select is(
  (select customer_name from public.v_quote_detail where code = 'COT-0002'),
  'Sin cliente',
  'the quote list labels a missing customer'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb,
    null
  )$$,
  '22023',
  'La cotización necesita una fecha de vigencia.',
  'a validity date is required'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null, '[]'::jsonb, current_date + 1
  )$$,
  '22023',
  'La cotización necesita al menos un producto.',
  'an empty quote is rejected'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null, '{}'::jsonb, current_date + 1
  )$$,
  '22023',
  'La cotización necesita al menos un producto.',
  'lines must be a JSON array'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":0}]'::jsonb,
    current_date + 1
  )$$,
  '22023',
  'Cada línea debe llevar una cantidad entera mayor que cero.',
  'zero quantity is rejected'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":-1},
      {"product_id":"50000000-0000-0000-0000-000000000003","qty":2}]'::jsonb,
    current_date + 1
  )$$,
  '22023',
  'Cada línea debe llevar una cantidad entera mayor que cero.',
  'an invalid line cannot be hidden by a repeated positive line'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1.5}]'::jsonb,
    current_date + 1
  )$$,
  '22023',
  'Cada línea debe llevar una cantidad entera mayor que cero.',
  'fractional quantity is rejected instead of rounded'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":2147483647},
      {"product_id":"50000000-0000-0000-0000-000000000003","qty":2147483647}]'::jsonb,
    current_date + 1
  )$$,
  '22023',
  'Cada línea debe llevar una cantidad entera mayor que cero.',
  'a merged quantity cannot overflow integer'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"not-a-uuid","qty":1}]'::jsonb,
    current_date + 1
  )$$,
  '22023',
  'Alguna línea de la cotización no tiene un producto o una cantidad válidos.',
  'a malformed product id is rejected with a stable message'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003"}]'::jsonb,
    current_date + 1
  )$$,
  '22023',
  'Cada línea debe llevar una cantidad entera mayor que cero.',
  'a missing quantity is rejected'
);

update public.product
set price = 9223372036854775807, cost = 9223372036854775807
where id = '50000000-0000-0000-0000-000000000009';

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000009","qty":2}]'::jsonb,
    current_date + 1
  )$$,
  '22003',
  'Los montos de la cotización superan el límite permitido.',
  'a quote cannot overflow its bigint money snapshots'
);

update public.product set active = false
where id = '50000000-0000-0000-0000-000000000009';

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000009","qty":1}]'::jsonb,
    current_date + 1
  )$$,
  'P0002',
  'Algún producto de la cotización no existe o no está disponible en este negocio.',
  'an inactive product is rejected'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"57000000-0000-0000-0000-000000000010","qty":1}]'::jsonb,
    current_date + 1
  )$$,
  'P0002',
  'Algún producto de la cotización no existe o no está disponible en este negocio.',
  'a product from another business is rejected'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001',
    '67000000-0000-0000-0000-000000000010',
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb,
    current_date + 1
  )$$,
  'P0002',
  'El cliente no existe en este negocio.',
  'a customer from another business is rejected'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000010', null,
    '[{"product_id":"57000000-0000-0000-0000-000000000010","qty":1}]'::jsonb,
    current_date + 1
  )$$,
  '42501',
  'No tienes acceso a este negocio.',
  'creating a quote in another business is rejected'
);

select is(
  (select next_value from public.doc_sequence
   where business_id = '20000000-0000-0000-0000-000000000001'
     and doc_type = 'QUOTE'),
  3,
  'rejected quotes do not consume document codes'
);

select throws_ok(
  $$insert into public.quote (business_id, code, valid_until)
    values ('20000000-0000-0000-0000-000000000001', 'COT-BYPASS-1', current_date + 1)$$,
  '42501',
  'permission denied for table quote',
  'a member cannot bypass create_quote with a direct insert'
);

select throws_ok(
  $$update public.quote set total = 1 where code = 'COT-0001'$$,
  '42501',
  'permission denied for table quote',
  'a member cannot rewrite a calculated quote total'
);

select throws_ok(
  $$insert into public.quote_line (quote_id, product_id, name_snapshot, qty, unit_price, unit_cost)
    values (
      (select id from public.quote where code = 'COT-0001'),
      '50000000-0000-0000-0000-000000000003', 'Línea falsa', 1, 1, 1
    )$$,
  '42501',
  'permission denied for table quote_line',
  'a member cannot rewrite quote snapshots directly'
);

select is(
  (select count(*) from public.v_quote_detail
   where business_id = '20000000-0000-0000-0000-000000000010'),
  0::bigint,
  'the summary view hides another business'
);

select is(
  (select count(*) from public.v_quote_line_detail
   where business_id = '20000000-0000-0000-0000-000000000010'),
  0::bigint,
  'the line view hides another business'
);

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb,
    current_date + 1
  )$$,
  '42501',
  'Debes iniciar sesión para crear una cotización.',
  'a request without a user is rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$with deleted as (
      delete from public.quote where code in ('COT-0001', 'COT-0002') returning code
    ) select code from deleted order by code$$,
  $$values ('COT-0001'::text), ('COT-0002'::text)$$,
  'open quotes can be deleted from the future list action'
);

select is(
  (select count(*) from public.quote_line
   where quote_id in (
     select (payload ->> 'id')::uuid from created_quote
   )),
  0::bigint,
  'deleting an open quote cascades to its frozen lines'
);

select * from finish();
rollback;
