begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.membership (business_id, user_id, role)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000010',
  'CASHIER'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$update public.business
    set phone = '8095550101'
    where id = '20000000-0000-0000-0000-000000000001'
    returning id$$,
  $$values ('20000000-0000-0000-0000-000000000001'::uuid)$$,
  'an owner can update their business'
);

select is(
  (select phone from public.business where id = '20000000-0000-0000-0000-000000000001'),
  '8095550101',
  'the owner update is persisted'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000010', true);

select is(
  (select count(*) from public.business where id = '20000000-0000-0000-0000-000000000001'),
  1::bigint,
  'a cashier can read the business they belong to'
);

select results_eq(
  $$update public.business
    set name = 'Cambio no permitido'
    where id = '20000000-0000-0000-0000-000000000001'
    returning id$$,
  $$select null::uuid where false$$,
  'a cashier cannot update business settings'
);

select is(
  (select name from public.business where id = '20000000-0000-0000-0000-000000000001'),
  'Cashi Demo',
  'a rejected business update changes nothing'
);

select results_eq(
  $$update public.profile
    set full_name = 'Usuario Ajustes'
    where id = '10000000-0000-0000-0000-000000000010'
    returning id$$,
  $$values ('10000000-0000-0000-0000-000000000010'::uuid)$$,
  'a user can update their own profile'
);

select results_eq(
  $$update public.profile
    set full_name = 'Cambio ajeno'
    where id = '10000000-0000-0000-0000-000000000001'
    returning id$$,
  $$select null::uuid where false$$,
  'a user cannot update another profile'
);

select is(
  (select count(*) from public.business where id = '20000000-0000-0000-0000-000000000010'),
  0::bigint,
  'settings cannot read an unrelated business'
);

select * from finish();
rollback;
