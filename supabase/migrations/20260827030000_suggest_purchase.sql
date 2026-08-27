-- S5.2 · Sugerencia de reposición.
-- La cantidad obedece exactamente la regla 2.8 del plan y el costo es solo un
-- estimado con el costo actual; recibir la orden será quien actualice stock.

create or replace function public.suggest_purchase(p_business uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para consultar la sugerencia de compra.';
  end if;

  if not public.is_member(p_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  with suggested as (
    select
      p.id as product_id,
      p.name,
      p.sku,
      p.category_id,
      c.name as category_name,
      p.supplier_id,
      s.name as supplier_name,
      p.stock,
      p.min_stock,
      p.cost as unit_cost,
      greatest(p.min_stock::bigint * 2 - p.stock::bigint, 1::bigint) as suggested_qty
    from public.product p
    left join public.category c on c.id = p.category_id
    left join public.supplier s on s.id = p.supplier_id
    where p.business_id = p_business
      and p.active
      and p.stock < p.min_stock
  )
  select jsonb_build_object(
    'business_id', p_business,
    'product_count', count(*),
    'total_units', coalesce(sum(suggested_qty), 0),
    'estimated_total', coalesce(sum(suggested_qty * unit_cost), 0),
    'lines', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', product_id,
          'name', name,
          'sku', sku,
          'category_id', category_id,
          'category_name', category_name,
          'supplier_id', supplier_id,
          'supplier_name', supplier_name,
          'stock', stock,
          'min_stock', min_stock,
          'suggested_qty', suggested_qty,
          'unit_cost', unit_cost,
          'estimated_cost', suggested_qty * unit_cost
        )
        order by supplier_name nulls last, name, product_id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from suggested;

  return v_result;
end;
$$;

comment on function public.suggest_purchase(uuid) is
  'Sugiere productos activos con stock < mínimo. Cantidad = max(mínimo × 2 − stock, 1); incluye costo actual y total estimado sin modificar datos.';

revoke all on function public.suggest_purchase(uuid) from public, anon;
grant execute on function public.suggest_purchase(uuid) to authenticated;
