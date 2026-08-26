begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Producto con un SKU que además aparece dentro del nombre de otro, para que el
-- orden por relevancia tenga algo que decidir.
insert into public.product (id, business_id, name, sku, cost, price, stock, min_stock, active)
values
  ('57000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Difusor con perfume', 'AURORA', 1000, 2000, 5, 1, true),
  ('57000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Producto retirado', 'OFF-001', 1000, 2000, 5, 1, false);

-- Orden: el SKU exacto gana, luego el nombre que empieza por el término.
select results_eq(
  $$select sku from public.search_products('20000000-0000-0000-0000-000000000001', 'aurora')$$,
  $$values ('AURORA'::text), ('PER-001')$$,
  'the exact sku wins over a name that only contains the term'
);

select results_eq(
  $$select sku from public.search_products('20000000-0000-0000-0000-000000000001', 'PER-')$$,
  $$values ('PER-001'::text), ('PER-002')$$,
  'a sku prefix returns that family'
);

select results_eq(
  $$select sku from public.search_products('20000000-0000-0000-0000-000000000001', 'perfume')$$,
  $$values ('PER-001'::text), ('PER-002'), ('AURORA')$$,
  'names starting with the term come before those that only contain it'
);

select is(
  (select name from public.search_products('20000000-0000-0000-0000-000000000001', 'perfume') offset 2 limit 1),
  'Difusor con perfume',
  'the partial match is the one left at the end'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000001', 'JABON')),
  0::bigint,
  'the search does not ignore accents by itself'
);

select results_eq(
  $$select sku from public.search_products('20000000-0000-0000-0000-000000000001', 'jabón')$$,
  $$values ('CUI-002'::text)$$,
  'the search is case insensitive'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000001', 'retirado')),
  0::bigint,
  'an inactive product never shows up'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000001', '')),
  0::bigint,
  'an empty term returns nothing'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000001', '   ')),
  0::bigint,
  'a blank term returns nothing'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000001', null)),
  0::bigint,
  'a null term returns nothing'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000001', 'e')),
  8::bigint,
  'the default limit is eight results'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000001', 'e', 3)),
  3::bigint,
  'the limit can be lowered'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000001', 'e', 500)),
  9::bigint,
  'the limit is capped at twenty, so everything matching fits'
);

select results_eq(
  $$select price, stock, is_low_stock, category_name
    from public.search_products('20000000-0000-0000-0000-000000000001', 'espejo')$$,
  $$values (13000::bigint, 2, true, 'Accesorios'::text)$$,
  'the search returns price, stock, the low flag and the category'
);

-- Frecuentes: dos ventas confirmadas y una anulada.
select public.create_sale(
  '20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":5},
    {"product_id":"50000000-0000-0000-0000-000000000001","qty":1}]'::jsonb
);
select public.create_sale(
  '20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":2}]'::jsonb
);

select results_eq(
  $$select sku, sold_qty from public.frequent_products('20000000-0000-0000-0000-000000000001')$$,
  $$values ('CUI-001'::text, 7), ('PER-001', 1)$$,
  'the most sold product comes first with its quantity'
);

select public.create_sale(
  '20000000-0000-0000-0000-000000000001', null, 'CASH', 0, null,
  '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":50}]'::jsonb
);
select public.void_sale((select id from public.sale where code = 'FAC-00003'));

select results_eq(
  $$select sku, sold_qty from public.frequent_products('20000000-0000-0000-0000-000000000001')$$,
  $$values ('CUI-001'::text, 7), ('PER-001', 1)$$,
  'a voided sale does not count towards the frequent products'
);

-- Fuera de la ventana de días.
update public.sale set sold_at = now() - interval '45 days' where code = 'FAC-00002';

select results_eq(
  $$select sku, sold_qty from public.frequent_products('20000000-0000-0000-0000-000000000001')$$,
  $$values ('CUI-001'::text, 5), ('PER-001', 1)$$,
  'sales older than the window are left out'
);

select results_eq(
  $$select sku, sold_qty from public.frequent_products('20000000-0000-0000-0000-000000000001', 8, 60)$$,
  $$values ('CUI-001'::text, 7), ('PER-001', 1)$$,
  'widening the window brings the old sale back'
);

select is(
  (select count(*) from public.frequent_products('20000000-0000-0000-0000-000000000001', 1)),
  1::bigint,
  'the frequent list honours its limit'
);

-- Aislamiento.
select throws_ok(
  $$select * from public.search_products('20000000-0000-0000-0000-000000000010', 'perfume')$$,
  '42501',
  'No tienes acceso a este negocio.',
  'searching in another business is rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is(
  (select count(*) from public.frequent_products('20000000-0000-0000-0000-000000000010')),
  0::bigint,
  'a business without sales has no frequent products'
);

select is(
  (select count(*) from public.search_products('20000000-0000-0000-0000-000000000010', 'perfume')),
  0::bigint,
  'the other business has no products to find'
);

select throws_ok(
  $$select * from public.frequent_products('20000000-0000-0000-0000-000000000001')$$,
  '42501',
  'No tienes acceso a este negocio.',
  'another user cannot read the frequent products of the demo business'
);

select * from finish();
rollback;
