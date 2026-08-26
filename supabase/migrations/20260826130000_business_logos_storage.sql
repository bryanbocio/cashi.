insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, 2097152, array['image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.logo_business_id(p_object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  business_segment text := split_part(p_object_name, '/', 1);
begin
  if p_object_name <> business_segment || '/logo.png'
     or business_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    return null;
  end if;

  return business_segment::uuid;
end;
$$;

revoke all on function public.logo_business_id(text) from public;
grant execute on function public.logo_business_id(text) to authenticated;

create policy "logos select member"
on storage.objects for select to authenticated
using (
  bucket_id = 'logos'
  and public.is_member(public.logo_business_id(name))
);

create policy "logos insert member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'logos'
  and public.is_member(public.logo_business_id(name))
);

create policy "logos update member"
on storage.objects for update to authenticated
using (
  bucket_id = 'logos'
  and public.is_member(public.logo_business_id(name))
)
with check (
  bucket_id = 'logos'
  and public.is_member(public.logo_business_id(name))
);

create policy "logos delete member"
on storage.objects for delete to authenticated
using (
  bucket_id = 'logos'
  and public.is_member(public.logo_business_id(name))
);
