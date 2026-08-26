begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Alta de dos productos con categoría y proveedor nuevos.
select is(
  (select public.import_products(
    '20000000-0000-0000-0000-000000000001',
    '[{"sku":"IMP-A","name":"Difusor","category":"Hogar","supplier":"Aromas del Norte","cost":10000,"price":18000,"stock":7,"min_stock":3},
      {"sku":"IMP-B","name":"Vela","category":"Hogar","supplier":null,"cost":5000,"price":9000,"stock":12,"min_stock":4}]'::jsonb
  ) ->> 'created')::integer,
  2,
  'creates the products that did not exist'
);

select is(
  (select count(*) from public.product
   where business_id = '20000000-0000-0000-0000-000000000001' and sku like 'IMP-%'),
  2::bigint,
  'both products are in the catalogue'
);

select is(
  (select stock from public.product where sku = 'IMP-A'),
  7,
  'a new product keeps the stock from the file'
);

select is(
  (select count(*) from public.category
   where business_id = '20000000-0000-0000-0000-000000000001' and name = 'Hogar'),
  1::bigint,
  'the missing category is created once'
);

select is(
  (select count(*) from public.supplier
   where business_id = '20000000-0000-0000-0000-000000000001' and name = 'Aromas del Norte'),
  1::bigint,
  'the missing supplier is created'
);

select ok(
  (select supplier_id is null from public.product where sku = 'IMP-B'),
  'a product without supplier keeps it empty'
);

-- Segunda pasada: actualiza y nunca toca las existencias.
select is(
  (select public.import_products(
    '20000000-0000-0000-0000-000000000001',
    '[{"sku":"IMP-A","name":"Difusor grande","category":"Hogar","supplier":"Aromas del Norte","cost":11000,"price":21000,"stock":999,"min_stock":5}]'::jsonb
  ) ->> 'updated')::integer,
  1,
  'an existing sku is updated instead of duplicated'
);

select is(
  (select public.import_products(
    '20000000-0000-0000-0000-000000000001',
    '[{"sku":"IMP-A","name":"Difusor grande","cost":11000,"price":21000,"stock":999,"min_stock":5}]'::jsonb
  ) ->> 'stock_ignored')::integer,
  1,
  'the ignored stock of an existing product is reported'
);

select is(
  (select stock from public.product where sku = 'IMP-A'),
  7,
  'the stock of an existing product never changes'
);

select results_eq(
  $$select name, cost, price, min_stock from public.product where sku = 'IMP-A'$$,
  $$values ('Difusor grande'::text, 11000::bigint, 21000::bigint, 5)$$,
  'name, cost, price and minimum are updated'
);

select is(
  (select count(*) from public.stock_movement where business_id = '20000000-0000-0000-0000-000000000001'),
  0::bigint,
  'importing never writes stock movements'
);

select is(
  (select count(*) from public.category
   where business_id = '20000000-0000-0000-0000-000000000001' and name = 'Hogar'),
  1::bigint,
  'the category is reused instead of duplicated'
);

-- El SKU se compara sin distinguir mayúsculas para no crear casi duplicados.
select is(
  (select public.import_products(
    '20000000-0000-0000-0000-000000000001',
    '[{"sku":"imp-a","name":"Difusor en minúsculas","cost":11000,"price":21000,"stock":0,"min_stock":5}]'::jsonb
  ) ->> 'updated')::integer,
  1,
  'the sku match ignores case'
);

-- Valores ausentes caen a cero, como los defaults de la tabla.
select results_eq(
  $$select cost, price, stock, min_stock from public.product where sku = 'IMP-C'$$,
  $$select null::bigint, null::bigint, null::integer, null::integer where false$$,
  'the product does not exist before importing it'
);

select is(
  (select public.import_products(
    '20000000-0000-0000-0000-000000000001',
    '[{"sku":"IMP-C","name":"Sin importes"}]'::jsonb
  ) ->> 'created')::integer,
  1,
  'a row without amounts is accepted'
);

select results_eq(
  $$select cost, price, stock, min_stock from public.product where sku = 'IMP-C'$$,
  $$values (0::bigint, 0::bigint, 0, 0)$$,
  'the missing amounts default to zero'
);

-- Validaciones.
select throws_ok(
  $$select public.import_products('20000000-0000-0000-0000-000000000001', '[{"sku":"IMP-D"}]'::jsonb)$$,
  '22023',
  'Cada producto necesita SKU y nombre.',
  'a row without a name is rejected'
);

select throws_ok(
  $$select public.import_products('20000000-0000-0000-0000-000000000010', '[{"sku":"IMP-E","name":"Ajeno"}]'::jsonb)$$,
  '42501',
  'No tienes acceso a este negocio.',
  'importing into another business is rejected'
);

select * from finish();
rollback;
