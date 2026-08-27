begin;

create extension if not exists pgtap with schema extensions;
select plan(36);

insert into public.business (id, name, timezone, created_by)
values (
  '20000000-0000-0000-0000-000000000020',
  'Negocio de métricas', 'America/Bogota',
  '10000000-0000-0000-0000-000000000001'
), (
  '20000000-0000-0000-0000-000000000021',
  'Negocio vacío de métricas', 'UTC',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.membership (business_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', 'OWNER'),
  ('20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', 'OWNER');

insert into public.customer (id, business_id, name)
values
  ('60000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000020', 'Cliente con saldo'),
  ('60000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000020', 'Cliente al día');

insert into public.sale (
  id, business_id, code, customer_id, payment_method, status,
  total, discount, sold_at, created_by
) values
  -- Periodo anterior: mayo de 2026.
  ('71000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000020', 'MET-MAY-1', null, 'CASH', 'CONFIRMED', 1000, 0, '2026-05-15 12:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  -- Periodo actual: junio de 2026. La primera fila cae justo en el inicio local.
  ('71000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000020', 'MET-JUN-1', null, 'CASH', 'CONFIRMED', 900, 100, '2026-06-01 00:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000020', 'MET-JUN-2', '60000000-0000-0000-0000-000000000020', 'CREDIT', 'CONFIRMED', 450, 50, '2026-06-30 23:59 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000020', 'MET-JUN-VOID', null, 'CASH', 'VOID', 1000, 0, '2026-06-20 12:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  -- El límite superior es exclusivo.
  ('71000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000020', 'MET-JUL-BOUNDARY', null, 'CASH', 'CONFIRMED', 777, 0, '2026-07-01 00:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  -- Créditos fuera del periodo: la cartera es una fotografía global.
  ('71000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000020', 'MET-OLD-CREDIT-1', '60000000-0000-0000-0000-000000000020', 'CREDIT', 'CONFIRMED', 1000, 0, '2026-04-10 12:00 America/Bogota', '10000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000020', 'MET-OLD-CREDIT-2', '60000000-0000-0000-0000-000000000021', 'CREDIT', 'CONFIRMED', 500, 0, '2026-04-11 12:00 America/Bogota', '10000000-0000-0000-0000-000000000001');

insert into public.sale_line (
  sale_id, name_snapshot, qty, unit_price, unit_cost
) values
  ('71000000-0000-0000-0000-000000000001', 'Venta mayo', 1, 1000, 600),
  ('71000000-0000-0000-0000-000000000002', 'Venta junio uno', 1, 1000, 500),
  ('71000000-0000-0000-0000-000000000003', 'Venta junio dos', 1, 500, 300),
  ('71000000-0000-0000-0000-000000000004', 'Venta anulada', 1, 1000, 100),
  ('71000000-0000-0000-0000-000000000005', 'Venta julio', 1, 777, 77),
  ('71000000-0000-0000-0000-000000000006', 'Crédito anterior uno', 1, 1000, 500),
  ('71000000-0000-0000-0000-000000000007', 'Crédito anterior dos', 1, 500, 250);

insert into public.payment (business_id, customer_id, amount, method, paid_at)
values
  ('20000000-0000-0000-0000-000000000020', '60000000-0000-0000-0000-000000000020', 200, 'CASH', '2026-06-10 12:00 America/Bogota'),
  ('20000000-0000-0000-0000-000000000020', '60000000-0000-0000-0000-000000000021', 500, 'CARD', '2026-06-11 12:00 America/Bogota');

insert into public.expense (business_id, concept, category, amount, spent_at)
values
  ('20000000-0000-0000-0000-000000000020', 'Gasto mayo', 'Pruebas', 100, '2026-05-15'),
  ('20000000-0000-0000-0000-000000000020', 'Gasto inicio junio', 'Pruebas', 200, '2026-06-01'),
  ('20000000-0000-0000-0000-000000000020', 'Gasto fin junio', 'Pruebas', 100, '2026-06-30'),
  ('20000000-0000-0000-0000-000000000020', 'Gasto julio', 'Pruebas', 999, '2026-07-01');

select ok(
  not has_function_privilege('anon', 'public.metrics_summary(uuid,text,integer)', 'execute'),
  'anon cannot execute metrics_summary'
);

select ok(
  has_function_privilege('authenticated', 'public.metrics_summary(uuid,text,integer)', 'execute'),
  'authenticated can execute metrics_summary'
);

select ok(
  not has_function_privilege('authenticated', 'private.metrics_summary_at(uuid,text,integer,timestamptz)', 'execute'),
  'the deterministic metrics helper is not exposed'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table metrics_month as
select private.metrics_summary_at(
  '20000000-0000-0000-0000-000000000020',
  'month', 1, '2026-07-15 12:00+00'
) as payload;

select is((select payload #>> '{range,from}' from metrics_month), '2026-06-01', 'the range exposes its local inclusive date');
select is((select payload #>> '{range,to}' from metrics_month), '2026-07-01', 'the range exposes its local exclusive date');
select is((select payload #>> '{range,label}' from metrics_month), 'junio 2026', 'the current month label is returned');
select is((select payload #>> '{range,previous_label}' from metrics_month), 'mayo 2026', 'the previous month label is returned');
select is((select (payload ->> 'revenue')::numeric from metrics_month), 1350::numeric, 'revenue sums only confirmed current sales');
select is((select (payload ->> 'gross_profit')::numeric from metrics_month), 550::numeric, 'gross profit uses frozen costs and subtracts each discount once');
select is((select (payload ->> 'expenses')::numeric from metrics_month), 300::numeric, 'expenses use the same local calendar range');
select is((select (payload ->> 'net_profit')::numeric from metrics_month), 250::numeric, 'net profit is gross profit minus expenses');
select is((select (payload ->> 'sales_count')::bigint from metrics_month), 2::bigint, 'sales count excludes void and out-of-range sales');
select is((select (payload ->> 'receivable')::numeric from metrics_month), 1250::numeric, 'receivable is the current global credit balance');
select is((select (payload ->> 'debtors_count')::bigint from metrics_month), 1::bigint, 'fully paid customers are not counted as debtors');
select is((select (payload #>> '{pct,revenue_change}')::numeric from metrics_month), 35.0::numeric, 'revenue change compares against the previous period');
select is((select (payload #>> '{pct,gross_margin}')::numeric from metrics_month), 40.7::numeric, 'gross margin is gross profit over revenue');
select is((select (payload #>> '{pct,gross_margin_pp}')::numeric from metrics_month), 0.7::numeric, 'gross margin change is expressed in percentage points');
select is((select (payload #>> '{pct,expense_ratio}')::numeric from metrics_month), 22.2::numeric, 'expense ratio is expenses over revenue');
select is((select (payload #>> '{pct,expense_ratio_pp}')::numeric from metrics_month), 12.2::numeric, 'expense ratio change is expressed in percentage points');
select is((select (payload #>> '{pct,net_margin}')::numeric from metrics_month), 18.5::numeric, 'net margin is net profit over revenue');
select is((select (payload #>> '{pct,net_profit_change}')::numeric from metrics_month), (-16.7)::numeric, 'net profit change compares amounts as a percentage');
select is(
  (select (payload #>> '{pct,gross_margin}')::numeric - (payload #>> '{pct,expense_ratio}')::numeric from metrics_month),
  (select (payload #>> '{pct,net_margin}')::numeric from metrics_month),
  'rounded gross margin minus expense ratio stays coherent with net margin'
);

create temporary table metrics_today as
select private.metrics_summary_at(
  '20000000-0000-0000-0000-000000000020',
  'today', 0, '2026-07-01 04:59+00'
) as payload;

select is((select payload #>> '{range,from}' from metrics_today), '2026-06-30', 'today follows the business date while UTC is already July');
select is((select (payload ->> 'revenue')::numeric from metrics_today), 450::numeric, 'the local day includes its late-night sale');
select is((select (payload ->> 'gross_profit')::numeric from metrics_today), 150::numeric, 'daily gross profit keeps the discount rule');
select is((select (payload ->> 'expenses')::numeric from metrics_today), 100::numeric, 'daily expenses use the same local date');
select is((select (payload ->> 'net_profit')::numeric from metrics_today), 50::numeric, 'daily net profit is coherent');
select is((select (payload ->> 'sales_count')::bigint from metrics_today), 1::bigint, 'the local day has exactly one confirmed sale');

create temporary table metrics_empty as
select private.metrics_summary_at(
  '20000000-0000-0000-0000-000000000021',
  'month', 0, '2026-07-15 12:00+00'
) as payload;

select is((select (payload ->> 'revenue')::numeric from metrics_empty), 0::numeric, 'an empty period returns zero revenue');
select is((select (payload ->> 'net_profit')::numeric from metrics_empty), 0::numeric, 'an empty period returns zero net profit');
select is(
  (select payload -> 'pct' from metrics_empty),
  '{"revenue_change":0,"gross_margin":0,"gross_margin_pp":0,"expense_ratio":0,"expense_ratio_pp":0,"net_margin":0,"net_profit_change":0}'::jsonb,
  'zero denominators return a complete zeroed percentage contract'
);
select is((select (payload ->> 'receivable')::numeric from metrics_empty), 0::numeric, 'a business without credit returns zero receivable');

set local role authenticated;

select throws_ok(
  $$select public.metrics_summary('20000000-0000-0000-0000-000000000020', 'quarter', 0)$$,
  '22023',
  'El periodo debe ser today, 7d o month.',
  'an unsupported period is rejected'
);

select throws_ok(
  $$select public.metrics_summary('20000000-0000-0000-0000-000000000010', 'month', 0)$$,
  '42501',
  'No tienes acceso a este negocio.',
  'a member cannot read another business metrics'
);

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.metrics_summary('20000000-0000-0000-0000-000000000020', 'month', 0)$$,
  '42501',
  'Debes iniciar sesión para consultar las métricas.',
  'a request without a user is rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is(
  jsonb_typeof(public.metrics_summary('20000000-0000-0000-0000-000000000020', 'month', 0)),
  'object',
  'the public RPC returns the documented JSON object'
);

select * from finish();
rollback;
