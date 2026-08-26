begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

select ok(
  exists (select 1 from storage.buckets where id = 'logos' and not public),
  'the logos bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'logos'),
  2097152::bigint,
  'logos are limited to 2 MiB'
);

select is(
  public.logo_business_id('20000000-0000-0000-0000-000000000001/logo.png'),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'a valid logo path resolves its business id'
);

select is(
  public.logo_business_id('20000000-0000-0000-0000-000000000001/other.png'),
  null::uuid,
  'only the canonical logo.png path is accepted'
);

insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values
  ('logos', '20000000-0000-0000-0000-000000000001/logo.png', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '{"mimetype":"image/png"}'),
  ('logos', '20000000-0000-0000-0000-000000000010/logo.png', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', '{"mimetype":"image/png"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from storage.objects where bucket_id = 'logos'),
  1::bigint,
  'a member reads only the logo from their business'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('logos', '20000000-0000-0000-0000-000000000001/logo-new.png', auth.uid(), auth.uid()::text, '{"mimetype":"image/png"}')$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'noncanonical logo paths are rejected'
);

select is(
  (select count(*) from storage.objects where name like '%/logo-new.png'),
  0::bigint,
  'a rejected object was not inserted'
);

select lives_ok(
  $$update storage.objects set user_metadata = '{"tested":true}' where name = '20000000-0000-0000-0000-000000000001/logo.png'$$,
  'a member can update their business logo'
);

select is(
  (select user_metadata ->> 'tested' from storage.objects where name = '20000000-0000-0000-0000-000000000001/logo.png'),
  'true',
  'the permitted logo update is applied'
);

select * from finish();
rollback;
