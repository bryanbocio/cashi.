begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

select throws_ok(
  $$select * from public.period_range('Mars/Olympus', 'month', 0)$$,
  '22023',
  'La zona horaria no es válida.',
  'an unknown timezone is rejected'
);

select throws_ok(
  $$select * from public.period_range('America/Bogota', 'quarter', 0)$$,
  '22023',
  'El periodo debe ser today, 7d o month.',
  'an unknown period is rejected'
);

select throws_ok(
  $$select * from private.period_range_at('America/Bogota', 'today', 0, null)$$,
  '22004',
  'La fecha de referencia es obligatoria.',
  'the explicit clock is required internally'
);

-- En Bogotá todavía es 28 de febrero aunque UTC ya esté en marzo.
select is(
  (select ("from" at time zone 'America/Bogota')::date
   from private.period_range_at('America/Bogota', 'today', 0, '2026-03-01 04:30+00')),
  '2026-02-28'::date,
  'today starts on the local calendar date, not the UTC date'
);

select is(
  (select "from" from private.period_range_at('America/Bogota', 'today', 0, '2026-03-01 04:30+00')),
  '2026-02-28 05:00+00'::timestamptz,
  'Bogota local midnight is converted to its UTC instant'
);

select is(
  (select "to" from private.period_range_at('America/Bogota', 'today', 0, '2026-03-01 04:30+00')),
  '2026-03-01 05:00+00'::timestamptz,
  'today ends at the next local midnight'
);

select is(
  (select prev_from from private.period_range_at('America/Bogota', 'today', 0, '2026-03-01 04:30+00')),
  '2026-02-27 05:00+00'::timestamptz,
  'the previous daily period starts one local day earlier'
);

select is(
  (select prev_to from private.period_range_at('America/Bogota', 'today', 0, '2026-03-01 04:30+00')),
  '2026-02-28 05:00+00'::timestamptz,
  'the previous daily period ends where today starts'
);

-- Nueva York adelanta el reloj el 8 de marzo de 2026: el día dura 23 horas.
select is(
  (select extract(epoch from ("to" - "from"))::bigint
   from private.period_range_at('America/New_York', 'today', 0, '2026-03-08 12:00+00')),
  82800::bigint,
  'a daylight-saving transition keeps local midnights and produces a 23-hour day'
);

-- Siete días incluyen hoy y cruzan correctamente el cambio de año.
select is(
  (select ("from" at time zone 'America/Santo_Domingo')::date
   from private.period_range_at('America/Santo_Domingo', '7d', 0, '2026-01-03 16:00+00')),
  '2025-12-28'::date,
  'the seven-day range starts six local dates before today'
);

select is(
  (select ("to" at time zone 'America/Santo_Domingo')::date
   from private.period_range_at('America/Santo_Domingo', '7d', 0, '2026-01-03 16:00+00')),
  '2026-01-04'::date,
  'the seven-day range has an exclusive next-day boundary'
);

select is(
  (select (prev_from at time zone 'America/Santo_Domingo')::date
   from private.period_range_at('America/Santo_Domingo', '7d', 0, '2026-01-03 16:00+00')),
  '2025-12-21'::date,
  'the previous seven-day range has the same number of calendar days'
);

select is(
  (select (prev_to at time zone 'America/Santo_Domingo')::date
   from private.period_range_at('America/Santo_Domingo', '7d', 0, '2026-01-03 16:00+00')),
  '2025-12-28'::date,
  'consecutive seven-day ranges do not overlap'
);

select is(
  (select label from private.period_range_at('America/Santo_Domingo', '7d', 0, '2026-01-03 16:00+00')),
  '28 diciembre 2025–3 enero 2026',
  'a seven-day label includes both years when the range crosses New Year'
);

-- Marzo compara contra febrero de 28 días.
select is(
  (select ("from" at time zone 'America/Bogota')::date
   from private.period_range_at('America/Bogota', 'month', 0, '2025-03-15 12:00+00')),
  '2025-03-01'::date,
  'a monthly range starts on day one'
);

select is(
  (select ("to" at time zone 'America/Bogota')::date
   from private.period_range_at('America/Bogota', 'month', 0, '2025-03-15 12:00+00')),
  '2025-04-01'::date,
  'a monthly range ends at the next month start'
);

select is(
  (select (prev_from at time zone 'America/Bogota')::date
   from private.period_range_at('America/Bogota', 'month', 0, '2025-03-15 12:00+00')),
  '2025-02-01'::date,
  'the previous month starts correctly after January'
);

select is(
  (select (prev_to at time zone 'America/Bogota')::date
   from private.period_range_at('America/Bogota', 'month', 0, '2025-03-15 12:00+00')),
  '2025-03-01'::date,
  'the previous February ends at March start'
);

select is(
  (select ((prev_to at time zone 'America/Bogota')::date - (prev_from at time zone 'America/Bogota')::date)
   from private.period_range_at('America/Bogota', 'month', 0, '2025-03-15 12:00+00')),
  28,
  'February 2025 contributes exactly 28 calendar days'
);

select is(
  (select ((prev_to at time zone 'America/Bogota')::date - (prev_from at time zone 'America/Bogota')::date)
   from private.period_range_at('America/Bogota', 'month', 0, '2025-04-15 12:00+00')),
  31,
  'March contributes exactly 31 calendar days'
);

select is(
  (select label from private.period_range_at('America/Bogota', 'month', 0, '2025-03-15 12:00+00')),
  'marzo 2025',
  'the current monthly label is localized in Spanish'
);

select is(
  (select previous_label from private.period_range_at('America/Bogota', 'month', 0, '2025-03-15 12:00+00')),
  'febrero 2025',
  'the previous monthly label is localized in Spanish'
);

-- Un offset grande cruza varios años sin aproximar meses como 30 días.
select is(
  (select ("from" at time zone 'America/Bogota')::date
   from private.period_range_at('America/Bogota', 'month', 38, '2026-03-15 12:00+00')),
  '2023-01-01'::date,
  'a large month offset lands on the correct year and month'
);

select is(
  (select (prev_from at time zone 'America/Bogota')::date
   from private.period_range_at('America/Bogota', 'month', 38, '2026-03-15 12:00+00')),
  '2022-12-01'::date,
  'the period before a large offset crosses the year boundary correctly'
);

select is(
  (select previous_label from private.period_range_at('America/Bogota', 'month', 0, '2026-01-15 12:00+00')),
  'diciembre 2025',
  'January compares against December of the previous year'
);

select is(
  (select ("from" at time zone 'America/Santo_Domingo')::date
   from public.period_range('America/Santo_Domingo', 'today', 0)),
  (current_timestamp at time zone 'America/Santo_Domingo')::date,
  'the public wrapper uses the current instant and the requested timezone'
);

select * from finish();
rollback;
