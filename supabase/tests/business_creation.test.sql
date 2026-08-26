begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', 'new-owner@cashi.local',
  crypt('NewOwner2026!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Nueva Propietaria","phone":"3001112233"}',
  now(), now(), '', '', '', ''
);

select is(
  (select count(*) from public.profile where id = '10000000-0000-0000-0000-000000000003'),
  1::bigint,
  'the auth trigger creates a profile'
);

select is(
  (select full_name from public.profile where id = '10000000-0000-0000-0000-000000000003'),
  'Nueva Propietaria',
  'the profile copies the full name from auth metadata'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temporary table created_business as
select public.create_business('Moda y Aroma', 'dop', 'America/Santo_Domingo') as id;

select is((select count(*) from created_business where id is not null), 1::bigint, 'create_business returns an id');

select is(
  (select count(*) from public.business b join created_business cb on cb.id = b.id),
  1::bigint,
  'the new business is visible to its owner'
);

select is(
  (select b.currency from public.business b join created_business cb on cb.id = b.id),
  'DOP',
  'currency is normalized to uppercase'
);

select is(
  (select count(*) from public.membership m join created_business cb on cb.id = m.business_id),
  1::bigint,
  'an owner membership is created'
);

select is(
  (select m.role from public.membership m join created_business cb on cb.id = m.business_id),
  'OWNER'::public.membership_role,
  'the initial membership has OWNER role'
);

select is(
  (select count(*) from public.category c join created_business cb on cb.id = c.business_id),
  2::bigint,
  'two base categories are created'
);

select results_eq(
  $$select c.name from public.category c join created_business cb on cb.id = c.business_id order by c.name$$,
  $$values ('Perfumería'::text), ('Tienda de ropa'::text)$$,
  'the requested base categories are created'
);

select is(
  (select count(*) from public.doc_sequence ds join created_business cb on cb.id = ds.business_id),
  3::bigint,
  'all document sequences are initialized'
);

select is(
  public.next_doc_code((select id from created_business), 'sale'),
  'FAC-00001',
  'sale codes use the FAC format'
);

select is(
  public.next_doc_code((select id from created_business), 'quote'),
  'COT-0001',
  'quote codes use the COT format'
);

select is(
  public.next_doc_code((select id from created_business), 'purchase'),
  'OC-0001',
  'purchase codes use the OC format'
);

select is(
  (select count(*) from public.doc_sequence ds join created_business cb on cb.id = ds.business_id where next_value = 2),
  3::bigint,
  'each code advances only its own sequence'
);

select throws_ok(
  $$select public.create_business('Inválido', 'PESOS', 'America/Bogota')$$,
  '22023',
  'La moneda debe ser un código ISO de tres letras.',
  'invalid currency is rejected'
);

select throws_ok(
  $$select public.next_doc_code('20000000-0000-0000-0000-000000000001', 'SALE')$$,
  '42501',
  'No tienes acceso a este negocio.',
  'a user cannot consume another business sequence'
);

select * from finish();
rollback;
