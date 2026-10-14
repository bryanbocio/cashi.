alter table public.business
  add column catalog_token text,
  add column catalog_enabled boolean not null default true;

update public.business
set catalog_token = encode(extensions.gen_random_bytes(12), 'hex')
where catalog_token is null;

alter table public.business
  alter column catalog_token set default encode(extensions.gen_random_bytes(12), 'hex'),
  alter column catalog_token set not null,
  add constraint business_catalog_token_format
    check (catalog_token ~ '^[a-f0-9]{24}$'),
  add constraint business_catalog_token_key unique (catalog_token);

create or replace function public.get_public_catalog(p_catalog text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'name', b.name,
      'currency', b.currency,
      'phone', b.phone,
      'address', b.address
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'category', c.name,
          'price', p.price,
          'available', p.stock > 0
        )
        order by (p.stock > 0) desc, p.name, p.id
      )
      from public.product p
      left join public.category c on c.id = p.category_id
      where p.business_id = b.id
        and p.active
    ), '[]'::jsonb)
  )
  from public.business b
  where b.catalog_token = lower(trim(p_catalog))
    and b.catalog_enabled;
$$;

comment on function public.get_public_catalog(text) is
  'Returns only the storefront-safe fields for an enabled public catalog.';

revoke all on function public.get_public_catalog(text) from public;
grant execute on function public.get_public_catalog(text) to anon, authenticated;
