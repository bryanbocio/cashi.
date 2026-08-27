begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.quote (
  id, business_id, code, customer_id, valid_until, status, total
) values (
  '79000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'COT-EXPIRED-CANCELLED', null, current_date - 10, 'CANCELLED', 79000
);

insert into public.quote_line (
  quote_id, product_id, name_snapshot, qty, unit_price, unit_cost
) values (
  '79000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Perfume Aurora 50 ml', 1, 79000, 48000
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table expired_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001', null,
  '[{"product_id":"50000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
  (current_timestamp at time zone 'America/Bogota')::date - 1
) as payload;

create temporary table today_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001', null,
  '[{"product_id":"50000000-0000-0000-0000-000000000003","qty":1}]'::jsonb,
  (current_timestamp at time zone 'America/Bogota')::date
) as payload;

create temporary table expiration_before as
select
  (select count(*) from public.sale) as sale_count,
  (select count(*) from public.stock_movement) as movement_count,
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000001') as stock,
  (select next_value from public.doc_sequence
   where business_id = '20000000-0000-0000-0000-000000000001'
     and doc_type = 'SALE') as sale_next;

select is(
  (select status::text from public.quote
   where id = (select (payload ->> 'id')::uuid from expired_quote)),
  'OPEN',
  'expiration is derived without mutating the persisted open state'
);

select is(
  (select status::text from public.v_quote_detail
   where id = (select (payload ->> 'id')::uuid from expired_quote)),
  'EXPIRED',
  'the quote summary exposes an expired effective state'
);

select is(
  (select status::text from public.v_quote_line_detail
   where quote_id = (select (payload ->> 'id')::uuid from expired_quote)
   limit 1),
  'EXPIRED',
  'the quote line view exposes the same expired state'
);

select is(
  (select status::text from public.v_quote_detail
   where id = '79000000-0000-0000-0000-000000000001'),
  'CANCELLED',
  'an explicit terminal state takes precedence over the date'
);

select is(
  (select status::text from public.v_quote_detail
   where id = (select (payload ->> 'id')::uuid from today_quote)),
  'OPEN',
  'a quote remains valid throughout its business-local valid-until date'
);

select throws_ok(
  $$select public.convert_quote(
    (select (payload ->> 'id')::uuid from expired_quote), 'CASH', null
  )$$,
  '22023',
  'La cotización está vencida y no se puede convertir.',
  'an expired-by-date open quote cannot be converted'
);

select is(
  (select count(*) from public.sale),
  (select sale_count from expiration_before),
  'the rejected conversion leaves no sale behind'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000001'),
  (select stock from expiration_before),
  'the rejected conversion rolls stock back'
);

select is(
  (select count(*) from public.stock_movement),
  (select movement_count from expiration_before),
  'the rejected conversion leaves no stock movement'
);

select is(
  (select next_value from public.doc_sequence
   where business_id = '20000000-0000-0000-0000-000000000001'
     and doc_type = 'SALE'),
  (select sale_next from expiration_before),
  'the rejected conversion consumes no sale code'
);

select is(
  (select status::text from public.quote
   where id = (select (payload ->> 'id')::uuid from expired_quote)),
  'OPEN',
  'the rejected conversion leaves the source document unchanged'
);

create temporary table today_conversion as
select public.convert_quote(
  (select (payload ->> 'id')::uuid from today_quote), 'CASH', null
) as payload;

select ok(
  (select (payload ->> 'id')::uuid is not null from today_conversion),
  'a quote valid today can still be converted'
);

select is(
  (select status::text from public.v_quote_detail
   where id = (select (payload ->> 'id')::uuid from today_quote)),
  'CONVERTED',
  'the converted state replaces the effective open state'
);

select * from finish();
rollback;
