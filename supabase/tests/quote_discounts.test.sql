begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(
  not has_function_privilege('anon', 'public.create_quote(uuid,uuid,jsonb,date,bigint)', 'execute'),
  'anon cannot create discounted quotes'
);

select ok(
  has_function_privilege('authenticated', 'public.create_quote(uuid,uuid,jsonb,date,bigint)', 'execute'),
  'authenticated users can create discounted quotes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table discounted_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000003',
  '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":2}]'::jsonb,
  current_date + 15,
  4000
) as payload;

select is(
  (select (payload ->> 'subtotal')::bigint from discounted_quote),
  64000::bigint,
  'the response keeps the subtotal before discount'
);

select is(
  (select (payload ->> 'discount')::bigint from discounted_quote),
  4000::bigint,
  'the response includes the discount'
);

select is(
  (select (payload ->> 'total')::bigint from discounted_quote),
  60000::bigint,
  'the response returns the discounted total'
);

select results_eq(
  $$select subtotal, discount, total, gross_profit
    from public.v_quote_detail
    where id = (select (payload ->> 'id')::uuid from discounted_quote)$$,
  $$values (64000::bigint, 4000::bigint, 60000::bigint, 24000::bigint)$$,
  'the quote view exposes subtotal, discount, net total and net profit'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb,
    current_date + 15, -1
  )$$,
  '22023',
  'El descuento no puede ser negativo.',
  'a negative quote discount is rejected'
);

select throws_ok(
  $$select public.create_quote(
    '20000000-0000-0000-0000-000000000001', null,
    '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb,
    current_date + 15, 32001
  )$$,
  '22023',
  'El descuento no puede superar el total de la cotización.',
  'a quote discount above its subtotal is rejected'
);

create temporary table converted_discounted_quote as
select public.convert_quote(
  (select (payload ->> 'id')::uuid from discounted_quote),
  'CASH',
  null
) as payload;

select is(
  (select (payload ->> 'discount')::bigint from converted_discounted_quote),
  4000::bigint,
  'conversion returns the quoted discount'
);

select is(
  (select (payload ->> 'total')::bigint from converted_discounted_quote),
  60000::bigint,
  'conversion returns the discounted sale total'
);

select results_eq(
  $$select s.discount, s.total
    from public.sale s
    where s.quote_id = (select (payload ->> 'id')::uuid from discounted_quote)$$,
  $$values (4000::bigint, 60000::bigint)$$,
  'the converted sale stores the quote discount and net total'
);

select is(
  (select discount from public.quote
   where id = (select (payload ->> 'id')::uuid from discounted_quote)),
  4000::bigint,
  'conversion does not rewrite the original quote discount'
);

create temporary table compatible_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001', null,
  '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb,
  current_date + 15
) as payload;

select is(
  (select q.discount from public.quote q
   where q.id = (select (payload ->> 'id')::uuid from compatible_quote)),
  0::bigint,
  'the original four-argument function remains compatible with zero discount'
);

select * from finish();
rollback;
