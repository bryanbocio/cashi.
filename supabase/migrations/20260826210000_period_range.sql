-- S7.1 · Rangos de calendario en la zona horaria del negocio.
-- La variante con reloj explícito vive fuera del API público para que las
-- pruebas puedan fijar bordes de mes y cambios de horario sin depender de hoy.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.period_label(
  p_from date,
  p_to date,
  p_period text
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_months constant text[] := array[
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  v_last date := p_to - 1;
begin
  if p_period = 'month' then
    return v_months[extract(month from p_from)::integer]
      || ' ' || extract(year from p_from)::integer;
  end if;

  if p_period = 'today' then
    return extract(day from p_from)::integer
      || ' ' || v_months[extract(month from p_from)::integer]
      || ' ' || extract(year from p_from)::integer;
  end if;

  if extract(year from p_from) = extract(year from v_last)
     and extract(month from p_from) = extract(month from v_last) then
    return extract(day from p_from)::integer
      || '–' || extract(day from v_last)::integer
      || ' ' || v_months[extract(month from p_from)::integer]
      || ' ' || extract(year from p_from)::integer;
  end if;

  if extract(year from p_from) = extract(year from v_last) then
    return extract(day from p_from)::integer
      || ' ' || v_months[extract(month from p_from)::integer]
      || '–' || extract(day from v_last)::integer
      || ' ' || v_months[extract(month from v_last)::integer]
      || ' ' || extract(year from p_from)::integer;
  end if;

  return extract(day from p_from)::integer
    || ' ' || v_months[extract(month from p_from)::integer]
    || ' ' || extract(year from p_from)::integer
    || '–' || extract(day from v_last)::integer
    || ' ' || v_months[extract(month from v_last)::integer]
    || ' ' || extract(year from v_last)::integer;
end;
$$;

create or replace function private.period_range_at(
  p_timezone text,
  p_period text,
  p_month_offset integer,
  p_now timestamptz
)
returns table (
  "from" timestamptz,
  "to" timestamptz,
  prev_from timestamptz,
  prev_to timestamptz,
  label text,
  previous_label text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_timezone text := trim(coalesce(p_timezone, ''));
  v_period text := lower(trim(coalesce(p_period, '')));
  v_offset integer := coalesce(p_month_offset, 0);
  v_anchor date;
  v_from date;
  v_to date;
  v_prev_from date;
  v_prev_to date;
begin
  if v_timezone = '' or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    raise exception using errcode = '22023', message = 'La zona horaria no es válida.';
  end if;

  if v_period not in ('today', '7d', 'month') then
    raise exception using errcode = '22023', message = 'El periodo debe ser today, 7d o month.';
  end if;

  if p_now is null then
    raise exception using errcode = '22004', message = 'La fecha de referencia es obligatoria.';
  end if;

  v_anchor := (p_now at time zone v_timezone)::date;

  if v_period = 'today' then
    v_from := v_anchor;
    v_to := v_anchor + 1;
    v_prev_from := v_anchor - 1;
    v_prev_to := v_anchor;
  elsif v_period = '7d' then
    v_from := v_anchor - 6;
    v_to := v_anchor + 1;
    v_prev_from := v_anchor - 13;
    v_prev_to := v_anchor - 6;
  else
    -- Un offset positivo navega hacia el pasado; cero es el mes actual.
    v_from := date_trunc(
      'month',
      v_anchor::timestamp - make_interval(months => v_offset)
    )::date;
    v_to := (v_from + interval '1 month')::date;
    v_prev_from := (v_from - interval '1 month')::date;
    v_prev_to := v_from;
  end if;

  return query
  select
    v_from::timestamp at time zone v_timezone,
    v_to::timestamp at time zone v_timezone,
    v_prev_from::timestamp at time zone v_timezone,
    v_prev_to::timestamp at time zone v_timezone,
    private.period_label(v_from, v_to, v_period),
    private.period_label(v_prev_from, v_prev_to, v_period);
end;
$$;

create or replace function public.period_range(
  p_timezone text,
  p_period text,
  p_month_offset integer default 0
)
returns table (
  "from" timestamptz,
  "to" timestamptz,
  prev_from timestamptz,
  prev_to timestamptz,
  label text,
  previous_label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from private.period_range_at(p_timezone, p_period, p_month_offset, current_timestamp);
$$;

comment on function public.period_range(text, text, integer) is
  'Devuelve límites [from, to) del periodo y del anterior en la zona indicada. Periodos: today, 7d y month; month_offset positivo navega hacia meses pasados.';

revoke all on function public.period_range(text, text, integer) from public;
grant execute on function public.period_range(text, text, integer) to authenticated;
