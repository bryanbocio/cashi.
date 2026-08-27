begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

-- Producto bajo de otro tenant para comprobar aislamiento y resultados propios.
insert into public.product (
  id, business_id, name, sku, cost, price, stock, min_stock
) values (
  '57000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000010',
  'Producto bajo ajeno', 'SUG-AJENO-1', 300, 500, 0, 2
);

select ok(
  not has_function_privilege('anon', 'public.suggest_purchase(uuid)', 'execute'),
  'anon cannot execute the purchase suggestion'
);

select ok(
  has_function_privilege('authenticated', 'public.suggest_purchase(uuid)', 'execute'),
  'authenticated can execute the purchase suggestion'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Seed: CUI-002 (3/5) sugiere 7 y ACC-003 (2/4) sugiere 6.
select is(
  (public.suggest_purchase('20000000-0000-0000-0000-000000000001') ->> 'product_count')::integer,
  2,
  'only active products strictly below minimum are suggested'
);

select is(
  (public.suggest_purchase('20000000-0000-0000-0000-000000000001') ->> 'total_units')::integer,
  13,
  'the seed suggestion adds the replenishment quantities'
);

select is(
  (public.suggest_purchase('20000000-0000-0000-0000-000000000001') ->> 'estimated_total')::bigint,
  108500::bigint,
  'the estimated total is calculated in PostgreSQL'
);

select is(
  jsonb_array_length(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines'),
  2,
  'the payload contains one line per suggested product'
);

select is(
  (select (line ->> 'suggested_qty')::integer
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'CUI-002'),
  7,
  'the formula raises CUI-002 to twice its minimum'
);

select is(
  (select (line ->> 'estimated_cost')::bigint
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'CUI-002'),
  66500::bigint,
  'each line exposes its estimated cost'
);

select is(
  (select (line ->> 'suggested_qty')::integer
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'ACC-003'),
  6,
  'the formula raises ACC-003 to twice its minimum'
);

select is(
  (select line ->> 'supplier_name'
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'CUI-002'),
  'Comercializadora Norte',
  'a suggestion preserves supplier information per line'
);

select is(
  (select count(*)
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'ACC-001'),
  0::bigint,
  'stock exactly equal to minimum is not low'
);

-- Bordes: stock negativo, costo cero e inactivos.
insert into public.product (
  id, business_id, name, sku, cost, price, stock, min_stock, active
) values
  ('57000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Stock negativo', 'SUG-NEG-1', 110, 200, -3, 4, true),
  ('57000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Costo cero', 'SUG-ZERO-1', 0, 50, 0, 1, true),
  ('57000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Bajo inactivo', 'SUG-OFF-1', 500, 900, 0, 5, false);

select is(
  (public.suggest_purchase('20000000-0000-0000-0000-000000000001') ->> 'product_count')::integer,
  4,
  'negative and zero-cost active products are included but inactive ones are not'
);

select is(
  (select (line ->> 'suggested_qty')::integer
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'SUG-NEG-1'),
  11,
  'negative stock is replenished all the way to twice the minimum'
);

select is(
  (select (line ->> 'suggested_qty')::integer
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'SUG-ZERO-1'),
  2,
  'a zero-cost product still receives a quantity suggestion'
);

select is(
  (select (line ->> 'estimated_cost')::bigint
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'SUG-ZERO-1'),
  0::bigint,
  'zero cost produces a zero estimate without dropping the line'
);

select is(
  (public.suggest_purchase('20000000-0000-0000-0000-000000000001') ->> 'total_units')::integer,
  26,
  'all edge-case quantities are added exactly'
);

select is(
  (public.suggest_purchase('20000000-0000-0000-0000-000000000001') ->> 'estimated_total')::bigint,
  109710::bigint,
  'the aggregate includes negative-stock and zero-cost lines'
);

select is(
  (select count(*)
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000001') -> 'lines') line
   where line ->> 'sku' = 'SUG-OFF-1'),
  0::bigint,
  'inactive products never appear in the suggestion'
);

select throws_ok(
  $$select public.suggest_purchase('20000000-0000-0000-0000-000000000010')$$,
  '42501',
  'No tienes acceso a este negocio.',
  'a member cannot request another business suggestion'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is(
  (public.suggest_purchase('20000000-0000-0000-0000-000000000010') ->> 'product_count')::integer,
  1,
  'the other owner receives their own suggestion'
);

select is(
  (select line ->> 'sku'
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000010') -> 'lines') line),
  'SUG-AJENO-1',
  'the other tenant payload contains only its product'
);

select is(
  (select count(*)
   from jsonb_array_elements(public.suggest_purchase('20000000-0000-0000-0000-000000000010') -> 'lines') line
   where line ->> 'sku' in ('CUI-002', 'ACC-003', 'SUG-NEG-1')),
  0::bigint,
  'the other tenant never receives demo products'
);

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.suggest_purchase('20000000-0000-0000-0000-000000000001')$$,
  '42501',
  'Debes iniciar sesión para consultar la sugerencia de compra.',
  'a request without a user is rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select public.suggest_purchase('29900000-0000-0000-0000-000000000099')$$,
  '42501',
  'No tienes acceso a este negocio.',
  'a missing business returns no suggestion'
);

select * from finish();
rollback;
