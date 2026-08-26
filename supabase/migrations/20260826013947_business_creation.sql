create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile (id, full_name, phone, avatar_url)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_business(
  p_name text,
  p_currency text,
  p_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
  v_name text := trim(p_name);
  v_currency text := upper(trim(p_currency));
  v_timezone text := trim(p_timezone);
begin
  if v_user is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para crear un negocio.';
  end if;

  if v_name is null or v_name = '' then
    raise exception using
      errcode = '22023',
      message = 'El nombre del negocio es obligatorio.';
  end if;

  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception using
      errcode = '22023',
      message = 'La moneda debe ser un código ISO de tres letras.';
  end if;

  if v_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    raise exception using
      errcode = '22023',
      message = 'La zona horaria no es válida.';
  end if;

  insert into public.business (name, currency, timezone, created_by)
  values (v_name, v_currency, v_timezone, v_user)
  returning id into v_business;

  insert into public.membership (business_id, user_id, role)
  values (v_business, v_user, 'OWNER');

  insert into public.category (business_id, name)
  values
    (v_business, 'Perfumería'),
    (v_business, 'Tienda de ropa');

  insert into public.doc_sequence (business_id, doc_type, next_value)
  values
    (v_business, 'SALE', 1),
    (v_business, 'QUOTE', 1),
    (v_business, 'PURCHASE', 1);

  return v_business;
end;
$$;

revoke all on function public.create_business(text, text, text) from public;
grant execute on function public.create_business(text, text, text) to authenticated;

create or replace function public.next_doc_code(
  p_business uuid,
  p_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.document_type;
  v_value integer;
  v_prefix text;
  v_width integer;
begin
  if not public.is_member(p_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  begin
    v_type := upper(trim(p_type))::public.document_type;
  exception
    when invalid_text_representation then
      raise exception using
        errcode = '22023',
        message = 'El tipo de documento no es válido.';
  end;

  update public.doc_sequence
  set next_value = next_value + 1
  where business_id = p_business and doc_type = v_type
  returning next_value - 1 into v_value;

  if v_value is null then
    raise exception using
      errcode = 'P0002',
      message = 'No existe una secuencia para este tipo de documento.';
  end if;

  select prefix, width
  into v_prefix, v_width
  from (
    values
      ('SALE'::public.document_type, 'FAC-', 5),
      ('QUOTE'::public.document_type, 'COT-', 4),
      ('PURCHASE'::public.document_type, 'OC-', 4)
  ) as formats(doc_type, prefix, width)
  where doc_type = v_type;

  return v_prefix || lpad(v_value::text, v_width, '0');
end;
$$;

revoke all on function public.next_doc_code(uuid, text) from public;
grant execute on function public.next_doc_code(uuid, text) to authenticated;
