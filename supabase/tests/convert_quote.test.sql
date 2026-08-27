begin;

create extension if not exists pgtap with schema extensions;
select plan(46);

-- Fixtures de estados especiales y otro tenant creados como postgres.
insert into public.product (id, business_id, name, sku, cost, price, stock, min_stock)
values (
  '58000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000010',
  'Producto ajeno para conversión', 'CONV-AJENO-1', 100, 250, 9, 1
), (
  '58000000-0000-0000-0000-000000000099',
  '20000000-0000-0000-0000-000000000001',
  'Producto eliminado antes de convertir', 'CONV-ELIM-1', 100, 250, 9, 1
);

insert into public.customer (id, business_id, name)
values (
  '68000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000010',
  'Cliente ajeno para conversión'
);

insert into public.quote (
  id, business_id, code, customer_id, valid_until, status, total
) values
  (
    '78000000-0000-0000-0000-000000000010',
    '20000000-0000-0000-0000-000000000010',
    'COT-CONV-AJENA', '68000000-0000-0000-0000-000000000010',
    current_date + 5, 'OPEN', 250
  ),
  (
    '78000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'COT-CONV-CANCELLED', null, current_date + 5, 'CANCELLED', 79000
  ),
  (
    '78000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'COT-CONV-EXPIRED', null, current_date - 1, 'EXPIRED', 79000
  ),
  (
    '78000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'COT-CONV-EMPTY', null, current_date + 5, 'OPEN', 0
  ),
  (
    '78000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    'COT-CONV-DELETED', null, current_date + 5, 'OPEN', 250
  );

insert into public.quote_line (
  quote_id, product_id, name_snapshot, qty, unit_price, unit_cost
) values
  (
    '78000000-0000-0000-0000-000000000010',
    '58000000-0000-0000-0000-000000000010',
    'Producto ajeno para conversión', 1, 250, 100
  ),
  (
    '78000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'Perfume Aurora 50 ml', 1, 79000, 48000
  ),
  (
    '78000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001',
    'Perfume Aurora 50 ml', 1, 79000, 48000
  ),
  (
    '78000000-0000-0000-0000-000000000004',
    '58000000-0000-0000-0000-000000000099',
    'Producto eliminado antes de convertir', 1, 250, 100
  );

delete from public.product where id = '58000000-0000-0000-0000-000000000099';

select ok(
  not has_function_privilege('anon', 'public.convert_quote(uuid,text,date)', 'execute'),
  'anon cannot convert quotes'
);

select ok(
  has_function_privilege('authenticated', 'public.convert_quote(uuid,text,date)', 'execute'),
  'authenticated can convert quotes'
);

select is(
  (select count(*)
   from pg_indexes
   where schemaname = 'public'
     and tablename = 'sale'
     and indexname = 'sale_quote_id_unique_idx'
     and indexdef like '%UNIQUE%WHERE (quote_id IS NOT NULL)%'),
  1::bigint,
  'a partial unique index allows only one sale per quote'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table cash_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000003',
  '[
    {"product_id":"50000000-0000-0000-0000-000000000001","qty":2},
    {"product_id":"50000000-0000-0000-0000-000000000003","qty":1}
  ]'::jsonb,
  current_date + 15
) as payload;

create temporary table cash_conversion as
select public.convert_quote(
  (select (payload ->> 'id')::uuid from cash_quote),
  'cash',
  current_date + 30
) as payload;

select is(
  (select payload ->> 'code' from cash_conversion),
  'FAC-00001',
  'converting creates a readable sale code'
);

select is(
  (select payload ->> 'quote_id' from cash_conversion),
  (select payload ->> 'id' from cash_quote),
  'the response links the source quote'
);

select is(
  (select payload ->> 'payment_method' from cash_conversion),
  'CASH',
  'the payment method is normalized by create_sale'
);

select ok(
  (select (payload ->> 'due_date') is null from cash_conversion),
  'a cash conversion ignores the due date'
);

select is(
  (select status::text from public.quote
   where id = (select (payload ->> 'id')::uuid from cash_quote)),
  'CONVERTED',
  'the source quote is marked converted'
);

select is(
  (select quote_id from public.sale
   where id = (select (payload ->> 'id')::uuid from cash_conversion)),
  (select (payload ->> 'id')::uuid from cash_quote),
  'the sale stores the quote foreign key'
);

select is(
  (select total from public.sale
   where id = (select (payload ->> 'id')::uuid from cash_conversion)),
  190000::bigint,
  'the converted sale uses create_sale totals'
);

select results_eq(
  $$select name_snapshot, qty, unit_price, unit_cost
    from public.sale_line
    where sale_id = (select (payload ->> 'id')::uuid from cash_conversion)
    order by name_snapshot$$,
  $$values
    ('Crema corporal 250 ml'::text, 1, 32000::bigint, 18000::bigint),
    ('Perfume Aurora 50 ml'::text, 2, 79000::bigint, 48000::bigint)$$,
  'the converted sale freezes its own current product values'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000001'),
  10,
  'conversion discounts the first product stock'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000003'),
  17,
  'conversion discounts the second product stock'
);

select is(
  (select count(*) from public.stock_movement
   where ref_id = (select (payload ->> 'id')::uuid from cash_conversion)
     and type = 'SALE'),
  2::bigint,
  'conversion writes one SALE movement per product'
);

select is(
  (select sum(qty_delta)::integer from public.stock_movement
   where ref_id = (select (payload ->> 'id')::uuid from cash_conversion)),
  -3,
  'the movements contain the exact converted quantity'
);

select is(
  (select total from public.quote
   where id = (select (payload ->> 'id')::uuid from cash_quote)),
  190000::bigint,
  'conversion preserves the original quote document total'
);

create temporary table cash_retry as
select public.convert_quote(
  (select (payload ->> 'id')::uuid from cash_quote),
  'CREDIT',
  current_date + 90
) as payload;

select is(
  (select payload ->> 'id' from cash_retry),
  (select payload ->> 'id' from cash_conversion),
  'retrying returns the original sale id'
);

select is(
  (select payload ->> 'code' from cash_retry),
  'FAC-00001',
  'retrying returns the original sale code'
);

select is(
  (select count(*) from public.sale
   where quote_id = (select (payload ->> 'id')::uuid from cash_quote)),
  1::bigint,
  'retrying creates no second sale'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000001'),
  10,
  'retrying does not discount stock twice'
);

select is(
  (select count(*) from public.stock_movement
   where ref_id = (select (payload ->> 'id')::uuid from cash_conversion)),
  2::bigint,
  'retrying writes no duplicate movements'
);

select is(
  (select next_value from public.doc_sequence
   where business_id = '20000000-0000-0000-0000-000000000001'
     and doc_type = 'SALE'),
  2,
  'retrying consumes no second sale code'
);

select is(
  (select status::text from public.v_quote_detail
   where id = (select (payload ->> 'id')::uuid from cash_quote)),
  'CONVERTED',
  'the quote list reflects conversion immediately'
);

select is_empty(
  $$delete from public.quote
    where id = (select (payload ->> 'id')::uuid from cash_quote)
    returning id$$,
  'a converted quote cannot be deleted from the direct list action'
);

create temporary table credit_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '[{"product_id":"50000000-0000-0000-0000-000000000006","qty":1}]'::jsonb,
  current_date + 15
) as payload;

create temporary table credit_conversion as
select public.convert_quote(
  (select (payload ->> 'id')::uuid from credit_quote),
  'CREDIT',
  '2026-10-31'
) as payload;

select is(
  (select payload ->> 'payment_method' from credit_conversion),
  'CREDIT',
  'a quote with a customer can convert to credit'
);

select is(
  (select payload ->> 'due_date' from credit_conversion),
  '2026-10-31',
  'a credit conversion keeps its due date'
);

select is(
  (select customer_id from public.sale
   where id = (select (payload ->> 'id')::uuid from credit_conversion)),
  '60000000-0000-0000-0000-000000000001'::uuid,
  'the credit sale keeps the quote customer'
);

select is(
  (select status::text from public.quote
   where id = (select (payload ->> 'id')::uuid from credit_quote)),
  'CONVERTED',
  'the credit quote is also closed'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000006'),
  3,
  'credit conversion discounts stock once'
);

create temporary table customerless_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001', null,
  '[{"product_id":"50000000-0000-0000-0000-000000000007","qty":1}]'::jsonb,
  current_date + 15
) as payload;

select throws_ok(
  $$select public.convert_quote(
    (select (payload ->> 'id')::uuid from customerless_quote),
    'CREDIT', current_date + 30
  )$$,
  '22023',
  'Una cotización a crédito necesita un cliente.',
  'credit conversion without a customer is rejected'
);

select is(
  (select status::text from public.quote
   where id = (select (payload ->> 'id')::uuid from customerless_quote)),
  'OPEN',
  'a rejected credit conversion leaves the quote open'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000007'),
  10,
  'a rejected credit conversion leaves stock untouched'
);

select is(
  (select public.convert_quote(
    (select (payload ->> 'id')::uuid from customerless_quote),
    'TRANSFER', null
  ) ->> 'code'),
  'FAC-00003',
  'the same customerless quote can still convert with another method'
);

create temporary table invalid_method_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001', null,
  '[{"product_id":"50000000-0000-0000-0000-000000000005","qty":1}]'::jsonb,
  current_date + 15
) as payload;

select throws_ok(
  $$select public.convert_quote(
    (select (payload ->> 'id')::uuid from invalid_method_quote),
    'EFECTIVO', null
  )$$,
  '22023',
  'El método de pago no es válido.',
  'an unknown payment method is rejected'
);

select is(
  (select status::text from public.quote
   where id = (select (payload ->> 'id')::uuid from invalid_method_quote)),
  'OPEN',
  'an invalid method leaves the quote open'
);

create temporary table inactive_product_quote as
select public.create_quote(
  '20000000-0000-0000-0000-000000000001', null,
  '[{"product_id":"50000000-0000-0000-0000-000000000009","qty":1}]'::jsonb,
  current_date + 15
) as payload;

update public.product set active = false
where id = '50000000-0000-0000-0000-000000000009';

select throws_ok(
  $$select public.convert_quote(
    (select (payload ->> 'id')::uuid from inactive_product_quote),
    'CASH', null
  )$$,
  'P0002',
  'Algún producto de la venta no existe o no está disponible en este negocio.',
  'create_sale rejects a product deactivated after quoting'
);

select is(
  (select status::text from public.quote
   where id = (select (payload ->> 'id')::uuid from inactive_product_quote)),
  'OPEN',
  'a failed sale rolls the quote state back to open'
);

select is(
  (select next_value from public.doc_sequence
   where business_id = '20000000-0000-0000-0000-000000000001'
     and doc_type = 'SALE'),
  4,
  'failed conversions consume no sale codes'
);

select throws_ok(
  $$select public.convert_quote(
    '78000000-0000-0000-0000-000000000001', 'CASH', null
  )$$,
  '22023',
  'Solo una cotización abierta se puede convertir.',
  'a cancelled quote cannot be converted'
);

select throws_ok(
  $$select public.convert_quote(
    '78000000-0000-0000-0000-000000000002', 'CASH', null
  )$$,
  '22023',
  'Solo una cotización abierta se puede convertir.',
  'an expired quote cannot be converted'
);

select throws_ok(
  $$select public.convert_quote(
    '78000000-0000-0000-0000-000000000003', 'CASH', null
  )$$,
  '22023',
  'La cotización necesita al menos un producto.',
  'an empty legacy quote cannot be converted'
);

select throws_ok(
  $$select public.convert_quote(
    '78000000-0000-0000-0000-000000000004', 'CASH', null
  )$$,
  'P0002',
  'Algún producto de la cotización ya no existe.',
  'a quote whose product was deleted cannot be converted'
);

select throws_ok(
  $$select public.convert_quote(
    '78900000-0000-0000-0000-000000000099', 'CASH', null
  )$$,
  'P0002',
  'La cotización no existe.',
  'a missing quote is rejected'
);

select throws_ok(
  $$select public.convert_quote(
    '78000000-0000-0000-0000-000000000010', 'CASH', null
  )$$,
  '42501',
  'No tienes acceso a este negocio.',
  'a quote from another business is rejected'
);

select throws_ok(
  $$insert into public.sale (
      business_id, code, customer_id, payment_method, total, quote_id, created_by
    ) values (
      '20000000-0000-0000-0000-000000000001', 'FAC-DUP-QUOTE', null,
      'CASH', 0, (select (payload ->> 'id')::uuid from cash_quote),
      '10000000-0000-0000-0000-000000000001'
    )$$,
  '23505',
  'duplicate key value violates unique constraint "sale_quote_id_unique_idx"',
  'the database rejects a second sale linked to the same quote'
);

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.convert_quote(
    (select (payload ->> 'id')::uuid from invalid_method_quote),
    'CASH', null
  )$$,
  '42501',
  'Debes iniciar sesión para convertir una cotización.',
  'a request without a user is rejected'
);

select * from finish();
rollback;
