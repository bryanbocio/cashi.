begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select ok(
  not has_function_privilege('anon', 'public.credit_dashboard_summary(uuid,timestamptz,timestamptz)', 'execute'),
  'anon cannot execute the credit summary'
);

select ok(
  has_function_privilege('authenticated', 'public.credit_dashboard_summary(uuid,timestamptz,timestamptz)', 'execute'),
  'authenticated can execute the credit summary'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select total_debt from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', date_trunc('month', current_timestamp), date_trunc('month', current_timestamp) + interval '1 month')),
  790000::bigint,
  'the summary adds every outstanding debt'
);

select is(
  (select debtor_count from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', date_trunc('month', current_timestamp), date_trunc('month', current_timestamp) + interval '1 month')),
  3::bigint,
  'the summary counts debtors'
);

select is(
  (select overdue_count from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', date_trunc('month', current_timestamp), date_trunc('month', current_timestamp) + interval '1 month')),
  1::bigint,
  'the summary counts overdue debtors'
);

select is(
  (select overdue_amount from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', date_trunc('month', current_timestamp), date_trunc('month', current_timestamp) + interval '1 month')),
  350000::bigint,
  'the summary adds overdue debt'
);

select is(
  (select paid_in_period from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', date_trunc('month', current_timestamp), date_trunc('month', current_timestamp) + interval '1 month')),
  100000::bigint,
  'the summary adds payments inside the requested period'
);

select is(
  (select paid_in_period from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', current_timestamp + interval '1 day', current_timestamp + interval '2 days')),
  0::bigint,
  'the payment range is half-open and can return zero'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is_empty(
  $$select * from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', current_timestamp - interval '1 month', current_timestamp + interval '1 month')$$,
  'another business member receives no summary row'
);

select set_config('request.jwt.claim.sub', '', true);

select is_empty(
  $$select * from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', current_timestamp - interval '1 month', current_timestamp + interval '1 month')$$,
  'a request without a user receives no summary row'
);

select is_empty(
  $$select * from public.credit_dashboard_summary(
    '20000000-0000-0000-0000-000000000001', current_timestamp, current_timestamp)$$,
  'an empty range produces no summary row'
);

select * from finish();
rollback;
