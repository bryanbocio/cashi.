begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

-- Un gasto ajeno dentro del mismo rango no puede entrar al agregado.
insert into public.expense (
  id, business_id, concept, category, amount, spent_at
) values (
  '93000000-0000-0000-0000-000000000099',
  '20000000-0000-0000-0000-000000000010',
  'Gasto ajeno', 'Servicios', 999999, '2031-02-10'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.expense (
  id, business_id, concept, category, amount, spent_at, recurring
) values
  (
    '93000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '  Factura eléctrica  ', '  Servicios  ', 250, '2031-02-01', true
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'Internet', 'Servicios', 750, '2031-02-15', true
  ),
  (
    '93000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'Reparación de puerta', 'Otro', 500, '2031-02-28', false
  ),
  (
    '93000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    'Fuera del rango', 'Otro', 900, '2031-03-01', false
  );

select is(
  (select concept from public.expense where id = '93000000-0000-0000-0000-000000000001'),
  'Factura eléctrica',
  'creating an expense trims its concept'
);

select is(
  (select category from public.expense where id = '93000000-0000-0000-0000-000000000001'),
  'Servicios',
  'creating an expense trims its category'
);

select is(
  (select amount from public.expense where id = '93000000-0000-0000-0000-000000000001'),
  250::bigint,
  'an expense can be created through the table CRUD'
);

update public.expense
set amount = 300, recurring = false
where id = '93000000-0000-0000-0000-000000000001';

select is(
  (select amount from public.expense where id = '93000000-0000-0000-0000-000000000001'),
  300::bigint,
  'an expense amount can be updated'
);

select isnt(
  (select recurring from public.expense where id = '93000000-0000-0000-0000-000000000001'),
  true,
  'the recurring flag can be updated'
);

select is(
  (select count(*) from public.expense
   where business_id = '20000000-0000-0000-0000-000000000001'
     and spent_at >= '2031-02-01' and spent_at < '2031-03-01'),
  3::bigint,
  'the list supports an exclusive local date range'
);

select is(
  (select count(*) from public.expense
   where business_id = '20000000-0000-0000-0000-000000000001'
     and spent_at >= '2031-02-01' and spent_at < '2031-03-01'
     and category = 'Servicios'),
  2::bigint,
  'the list combines date and category filters'
);

select is(
  (select count(*) from public.expense
   where business_id = '20000000-0000-0000-0000-000000000001'
     and spent_at >= '2031-02-01' and spent_at < '2031-03-01'
     and concept = 'Fuera del rango'),
  0::bigint,
  'the exclusive upper boundary leaves the next month out'
);

select is(
  (select count(*) from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01'
  )),
  2::bigint,
  'the aggregate returns one row per category'
);

select results_eq(
  $$select category from public.expense_category_totals(
      '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01'
    )$$,
  $$values ('Servicios'::text), ('Otro')$$,
  'categories are ordered from highest to lowest total'
);

select is(
  (select total_amount from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01'
  ) where category = 'Servicios'),
  1050::bigint,
  'the aggregate sums every expense in a category'
);

select is(
  (select expense_count from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01'
  ) where category = 'Servicios'),
  2::bigint,
  'the aggregate counts the expenses in a category'
);

select is(
  (select share_pct from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01'
  ) where category = 'Servicios'),
  67.74::numeric,
  'the leading category reports its share of the complete range'
);

select is(
  (select total_amount from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01'
  ) where category = 'Otro'),
  500::bigint,
  'custom concepts remain grouped under Otro'
);

select is(
  (select share_pct from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01'
  ) where category = 'Otro'),
  32.26::numeric,
  'the remaining category completes the distribution'
);

select is(
  (select count(*) from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01', 'SERVICIOS'
  )),
  1::bigint,
  'the optional category filter is case insensitive'
);

select is(
  (select share_pct from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01', 'servicios'
  )),
  67.74::numeric,
  'a filtered category keeps its share of the unfiltered total'
);

select is(
  (select count(*) from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-03-01', '   '
  )),
  2::bigint,
  'a blank category means all categories'
);

select is(
  (select count(*) from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2032-01-01', '2032-02-01'
  )),
  0::bigint,
  'an empty range returns no category rows'
);

select throws_ok(
  $$select * from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', '2031-02-01'
  )$$,
  '22023',
  'La fecha final debe ser posterior a la inicial.',
  'an empty range is rejected'
);

select throws_ok(
  $$select * from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-03-01', '2031-02-01'
  )$$,
  '22023',
  'La fecha final debe ser posterior a la inicial.',
  'a reversed range is rejected'
);

select throws_ok(
  $$select * from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', null, '2031-03-01'
  )$$,
  '22004',
  'El rango de fechas es obligatorio.',
  'the start date is required'
);

select throws_ok(
  $$select * from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000001', '2031-02-01', null
  )$$,
  '22004',
  'El rango de fechas es obligatorio.',
  'the end date is required'
);

select throws_ok(
  $$select * from public.expense_category_totals(
    '20000000-0000-0000-0000-000000000010', '2031-02-01', '2031-03-01'
  )$$,
  '42501',
  'No tienes acceso a este negocio.',
  'a member cannot aggregate another business'
);

select is(
  (select count(*) from public.expense
   where id = '93000000-0000-0000-0000-000000000099'),
  0::bigint,
  'RLS hides expenses from another business'
);

select throws_ok(
  $$insert into public.expense (business_id, concept, category, amount, spent_at)
    values ('20000000-0000-0000-0000-000000000010', 'Intruso', 'Otro', 1, '2031-02-10')$$,
  '42501',
  'new row violates row-level security policy for table "expense"',
  'a member cannot create an expense in another business'
);

delete from public.expense
where id = '93000000-0000-0000-0000-000000000003';

select is(
  (select count(*) from public.expense where id = '93000000-0000-0000-0000-000000000003'),
  0::bigint,
  'an expense can be deleted through the table CRUD'
);

select * from finish();
rollback;
