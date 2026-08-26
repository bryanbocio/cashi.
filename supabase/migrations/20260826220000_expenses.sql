-- S4.1 · Gastos.
-- El CRUD usa directamente la tabla `expense`, protegida por las políticas
-- RLS existentes. Esta migración completa el contrato de lectura para la
-- distribución por categoría y normaliza los textos escritos por el usuario.

create or replace function private.normalize_expense_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.concept := trim(new.concept);
  new.category := trim(new.category);
  return new;
end;
$$;

create trigger normalize_expense_text
before insert or update of concept, category on public.expense
for each row execute function private.normalize_expense_text();

create or replace function public.expense_category_totals(
  p_business uuid,
  p_from date,
  p_to date,
  p_category text default null
)
returns table (
  category text,
  total_amount bigint,
  expense_count bigint,
  share_pct numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_category text := nullif(trim(coalesce(p_category, '')), '');
begin
  if not public.is_member(p_business) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este negocio.';
  end if;

  if p_from is null or p_to is null then
    raise exception using errcode = '22004', message = 'El rango de fechas es obligatorio.';
  end if;

  if p_to <= p_from then
    raise exception using errcode = '22023', message = 'La fecha final debe ser posterior a la inicial.';
  end if;

  return query
  with range_expenses as (
    select trim(e.category) as category, e.amount
    from public.expense e
    where e.business_id = p_business
      and e.spent_at >= p_from
      and e.spent_at < p_to
  ),
  grouped as (
    select e.category, sum(e.amount)::bigint as total_amount,
           count(*)::bigint as expense_count
    from range_expenses e
    group by e.category
  ),
  overall as (
    select coalesce(sum(e.amount), 0)::numeric as total_amount
    from range_expenses e
  )
  select
    g.category,
    g.total_amount,
    g.expense_count,
    round(g.total_amount::numeric * 100 / nullif(o.total_amount, 0), 2)
  from grouped g
  cross join overall o
  where v_category is null or lower(g.category) = lower(v_category)
  order by g.total_amount desc, g.category;
end;
$$;

comment on function public.expense_category_totals(uuid, date, date, text) is
  'Agrupa gastos por categoría dentro del rango local [from, to). El filtro opcional de categoría no distingue mayúsculas; share_pct siempre se calcula contra el total completo del rango.';

revoke all on function public.expense_category_totals(uuid, date, date, text) from public;
grant execute on function public.expense_category_totals(uuid, date, date, text) to authenticated;

-- El índice original cubre el rango por fecha. Este cubre el filtro combinado
-- por categoría y fecha que usa la vista de Gastos.
create index if not exists expense_business_category_spent_at_idx
  on public.expense(business_id, category, spent_at);
