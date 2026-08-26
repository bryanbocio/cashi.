-- Resumen global del inventario activo. Se calcula en Postgres para que el
-- valor no dependa de los filtros ni del límite de filas de la interfaz.
create or replace view public.v_inventory_summary
with (security_invoker = true)
as
select
  p.business_id,
  count(*)::bigint as product_count,
  coalesce(sum(p.stock), 0)::bigint as stock_units,
  coalesce(sum(p.cost * p.stock), 0)::bigint as inventory_value,
  coalesce(sum(p.price * p.stock), 0)::bigint as retail_value
from public.product p
where p.active
group by p.business_id;

comment on view public.v_inventory_summary is
  'Valor completo del inventario activo por negocio. Hereda la RLS de product mediante security_invoker.';

revoke all on public.v_inventory_summary from public, anon;
grant select on public.v_inventory_summary to authenticated;

