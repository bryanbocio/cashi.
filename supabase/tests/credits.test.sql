begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

select is(
  private.credit_is_overdue_at('2026-01-01', 'Pacific/Kiritimati', '2026-01-01 10:30+00'),
  true,
  'a due date is overdue when the business has already reached the next local day'
);

select is(
  private.credit_is_overdue_at('2026-01-01', 'Pacific/Honolulu', '2026-01-01 10:30+00'),
  false,
  'the same instant is not overdue where the business is still on the due date'
);

select is(
  private.credit_is_overdue_at(null, 'America/Bogota', '2026-01-01 10:30+00'),
  false,
  'a credit without a due date is not marked overdue'
);

update public.business
set timezone = 'Pacific/Kiritimati'
where id = '20000000-0000-0000-0000-000000000001';

insert into public.customer (id, business_id, name, phone) values
  (
    '96000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Crédito parcialmente reciente', '3001000001'
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'Crédito vencido', '3001000002'
  ),
  (
    '96000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'Crédito pagado', '3001000003'
  ),
  (
    '96000000-0000-0000-0000-000000000099',
    '20000000-0000-0000-0000-000000000010',
    'Crédito de otro negocio', '3001000099'
  );

insert into public.sale (
  id, business_id, code, customer_id, payment_method, status,
  total, due_date, sold_at, created_by
) values
  (
    '97000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', 'CRED-TEST-001',
    '96000000-0000-0000-0000-000000000001', 'CREDIT', 'CONFIRMED',
    1000, (current_timestamp at time zone 'Pacific/Kiritimati')::date - 2,
    current_timestamp - interval '10 days', '10000000-0000-0000-0000-000000000001'
  ),
  (
    '97000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001', 'CRED-TEST-002',
    '96000000-0000-0000-0000-000000000001', 'CREDIT', 'CONFIRMED',
    600, (current_timestamp at time zone 'Pacific/Kiritimati')::date + 2,
    current_timestamp - interval '5 days', '10000000-0000-0000-0000-000000000001'
  ),
  (
    '97000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001', 'CRED-TEST-003',
    '96000000-0000-0000-0000-000000000001', 'CREDIT', 'VOID',
    500, (current_timestamp at time zone 'Pacific/Kiritimati')::date - 20,
    current_timestamp - interval '20 days', '10000000-0000-0000-0000-000000000001'
  ),
  (
    '97000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001', 'CRED-TEST-004',
    '96000000-0000-0000-0000-000000000001', 'CASH', 'CONFIRMED',
    999, null, current_timestamp - interval '1 day',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '97000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001', 'CRED-TEST-005',
    '96000000-0000-0000-0000-000000000002', 'CREDIT', 'CONFIRMED',
    500, (current_timestamp at time zone 'Pacific/Kiritimati')::date - 1,
    current_timestamp - interval '3 days', '10000000-0000-0000-0000-000000000001'
  ),
  (
    '97000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000001', 'CRED-TEST-006',
    '96000000-0000-0000-0000-000000000003', 'CREDIT', 'CONFIRMED',
    300, (current_timestamp at time zone 'Pacific/Kiritimati')::date - 1,
    current_timestamp - interval '2 days', '10000000-0000-0000-0000-000000000001'
  ),
  (
    '97000000-0000-0000-0000-000000000099',
    '20000000-0000-0000-0000-000000000010', 'CRED-OTHER-001',
    '96000000-0000-0000-0000-000000000099', 'CREDIT', 'CONFIRMED',
    900, current_date - 1, current_timestamp - interval '2 days',
    '10000000-0000-0000-0000-000000000011'
  );

insert into public.payment (
  id, business_id, customer_id, amount, method, paid_at
) values
  (
    '98000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000001', 1200, 'CASH', current_timestamp - interval '1 day'
  ),
  (
    '98000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000002', 100, 'CARD', current_timestamp - interval '1 day'
  ),
  (
    '98000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000003', 300, 'TRANSFER', current_timestamp - interval '1 day'
  ),
  (
    '98000000-0000-0000-0000-000000000099',
    '20000000-0000-0000-0000-000000000010',
    '96000000-0000-0000-0000-000000000099', 100, 'CASH', current_timestamp - interval '1 day'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (select 'security_invoker=true' = any(c.reloptions)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'v_credits'),
  'the credit view declares security_invoker'
);

select ok(
  not has_table_privilege('anon', 'public.v_credits', 'select'),
  'anon cannot read the credit view'
);

select is(
  (select count(*) from public.v_credits),
  2::bigint,
  'the owner sees only customers with debt from their business'
);

select is(
  (select count(*) from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000099'),
  0::bigint,
  'RLS hides the other business debtor'
);

select is(
  (select total_credit from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000001'),
  1600::bigint,
  'only confirmed credit sales contribute to total credit'
);

select is(
  (select total_paid from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000001'),
  1200::bigint,
  'the view sums every customer payment'
);

select is(
  (select debt from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000001'),
  400::bigint,
  'debt is confirmed credit minus payments'
);

select is(
  (select credit_sales_count from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000001'),
  2,
  'the view counts the confirmed credit sales'
);

select is(
  (select oldest_due_date from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000001'),
  (current_timestamp at time zone 'Pacific/Kiritimati')::date + 2,
  'payments cover the oldest sale before the newer one'
);

select isnt(
  (select is_overdue from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000001'),
  true,
  'a covered old invoice does not make the remaining recent debt overdue'
);

select is(
  (select days_overdue from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000001'),
  0,
  'a current debt reports zero overdue days'
);

select is(
  (select oldest_due_date from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000002'),
  (current_timestamp at time zone 'Pacific/Kiritimati')::date - 1,
  'the unpaid customer keeps the due date of the outstanding sale'
);

select is(
  (select is_overdue from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000002'),
  true,
  'the due date is compared with the business local date'
);

select is(
  (select days_overdue from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000002'),
  1,
  'the overdue day count uses local calendar dates'
);

select is(
  (select count(*) from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000003'),
  0::bigint,
  'a fully paid customer is absent from the debtor list'
);

select is(
  (public.register_payment(
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000001', 400, ' transfer '
  ) ->> 'previous_debt')::bigint,
  400::bigint,
  'register_payment returns the debt before the payment'
);

select is(
  (select (sum(amount) - 1200)::bigint from public.payment
   where customer_id = '96000000-0000-0000-0000-000000000001'),
  400::bigint,
  'the accepted payment is stored once'
);

select is(
  (select method::text from public.payment
   where customer_id = '96000000-0000-0000-0000-000000000001'
   order by paid_at desc limit 1),
  'TRANSFER',
  'the payment method is normalized and stored'
);

select is(
  (select count(*) from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000001'),
  0::bigint,
  'paying the exact debt removes the customer from the view'
);

select throws_ok(
  $$select public.register_payment(
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000002', 401, 'CASH'
  )$$,
  '22023',
  'El abono no puede superar la deuda pendiente.',
  'a payment larger than the debt is rejected'
);

select is(
  (select debt from public.v_credits where customer_id = '96000000-0000-0000-0000-000000000002'),
  400::bigint,
  'a rejected overpayment leaves the debt unchanged'
);

select throws_ok(
  $$select public.register_payment(
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000002', 0, 'CASH'
  )$$,
  '22023',
  'El abono debe ser mayor que cero.',
  'a zero payment is rejected'
);

select throws_ok(
  $$select public.register_payment(
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000002', null, 'CASH'
  )$$,
  '22023',
  'El abono debe ser mayor que cero.',
  'a null payment is rejected'
);

select throws_ok(
  $$select public.register_payment(
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000002', 100, 'CREDIT'
  )$$,
  '22023',
  'Un abono no puede registrarse como fiado.',
  'credit is not a valid payment method for a payment'
);

select throws_ok(
  $$select public.register_payment(
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000002', 100, 'CHEQUE'
  )$$,
  '22023',
  'El método de pago no es válido.',
  'an unknown payment method is rejected'
);

select throws_ok(
  $$select public.register_payment(
    '20000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000098', 100, 'CASH'
  )$$,
  'P0002',
  'El cliente no existe en este negocio.',
  'a missing customer is rejected'
);

select throws_ok(
  $$select public.register_payment(
    '20000000-0000-0000-0000-000000000010',
    '96000000-0000-0000-0000-000000000099', 100, 'CASH'
  )$$,
  '42501',
  'No tienes acceso a este negocio.',
  'a member cannot pay debt from another business'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment', 'insert'),
  'authenticated cannot bypass register_payment with a direct insert'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment', 'update'),
  'authenticated cannot rewrite an audited payment'
);

select ok(
  not has_table_privilege('authenticated', 'public.payment', 'delete'),
  'authenticated cannot delete an audited payment'
);

select throws_ok(
  $$select public.void_sale('97000000-0000-0000-0000-000000000002')$$,
  '23514',
  'La operación dejaría la deuda del cliente en negativo.',
  'a paid credit sale cannot be voided if that would create a negative debt'
);

select is(
  (select status::text from public.sale where id = '97000000-0000-0000-0000-000000000002'),
  'CONFIRMED',
  'a rejected void keeps the credit sale confirmed'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is(
  (select count(*) from public.v_credits),
  1::bigint,
  'the other owner sees only their own debtor'
);

select is(
  (select customer_name from public.v_credits),
  'Crédito de otro negocio',
  'the other owner cannot see a debtor from the demo business'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*) from public.v_credits),
  1::bigint,
  'the demo owner still sees the one remaining debtor'
);

select is(
  (select debt from public.v_credits),
  400::bigint,
  'the remaining debt never became negative'
);

select * from finish();
rollback;
