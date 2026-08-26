create or replace function public.logo_business_id(p_object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  business_segment text := split_part(p_object_name, '/', 1);
begin
  if p_object_name <> business_segment || '/logo.png' then
    return null;
  end if;

  begin
    return business_segment::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;
