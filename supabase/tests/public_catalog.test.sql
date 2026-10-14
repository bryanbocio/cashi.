begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

update public.business
set catalog_token = 'aaaaaaaaaaaaaaaaaaaaaaaa', catalog_enabled = true
where id = '20000000-0000-0000-0000-000000000001';

update public.product
set stock = 0
where id = '50000000-0000-0000-0000-000000000008';

update public.product
set active = false
where id = '50000000-0000-0000-0000-000000000009';

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select has_function(
  'public', 'get_public_catalog', array['text'],
  'the public catalog RPC exists'
);

select lives_ok(
  $$select public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'an anonymous visitor can load an enabled catalog'
);

select is(
  public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa') #>> '{business,name}',
  'Cashi Demo',
  'the catalog identifies the store'
);

select is(
  public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa') #>> '{business,currency}',
  'COP',
  'the catalog provides the display currency'
);

select is(
  jsonb_array_length(public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa') -> 'products'),
  8,
  'the catalog includes active products and excludes inactive ones'
);

select is(
  public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa') #>> '{products,0,name}',
  'Cosmetiquera',
  'available products are returned in name order'
);

select is(
  (
    select product ->> 'price'
    from jsonb_array_elements(public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa') -> 'products') product
    where product ->> 'name' = 'Perfume Aurora 50 ml'
  ),
  '79000',
  'the public price is the selling price'
);

select is(
  (
    select product ->> 'available'
    from jsonb_array_elements(public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa') -> 'products') product
    where product ->> 'name' = 'Espejo compacto'
  ),
  'false',
  'zero stock is exposed only as unavailable'
);

select is(
  position('"cost"' in public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa')::text),
  0,
  'the catalog never exposes product cost'
);

select is(
  position('"sku"' in public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa')::text),
  0,
  'the catalog never exposes internal SKUs'
);

select is(
  public.get_public_catalog('bbbbbbbbbbbbbbbbbbbbbbbb'),
  null::jsonb,
  'an unknown link reveals nothing'
);

reset role;
update public.business
set catalog_enabled = false
where id = '20000000-0000-0000-0000-000000000001';
set local role anon;

select is(
  public.get_public_catalog('aaaaaaaaaaaaaaaaaaaaaaaa'),
  null::jsonb,
  'a disabled catalog is no longer public'
);

select * from finish();
rollback;
