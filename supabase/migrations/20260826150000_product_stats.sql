-- S2.1 · Consultas de producto.
-- La vista concentra los cálculos de dinero del catálogo (margen, valor de
-- inventario y banderas de reposición) para que ni el cliente ni cada consulta
-- los repitan. `security_invoker` es obligatorio: sin él la vista se ejecuta
-- con los permisos de su dueño, ignora la RLS de `product` y expondría el
-- catálogo de todos los negocios.

create or replace view public.v_product_stats
with (security_invoker = true) as
select
  p.id,
  p.business_id,
  p.name,
  p.sku,
  p.active,
  p.category_id,
  c.name as category_name,
  p.supplier_id,
  s.name as supplier_name,
  p.cost,
  p.price,
  p.stock,
  p.min_stock,
  p.price - p.cost as margin_amount,
  case
    when p.price > 0 then round((p.price - p.cost)::numeric * 100 / p.price, 2)
  end as margin_pct,
  p.cost * p.stock as inventory_value,
  p.price * p.stock as retail_value,
  p.stock < p.min_stock as is_low_stock,
  case
    when p.price = 0 then p.cost > 0
    else (p.price - p.cost)::numeric * 100 / p.price < 20
  end as is_thin_margin,
  p.created_at,
  p.updated_at
from public.product p
left join public.category c on c.id = p.category_id
left join public.supplier s on s.id = p.supplier_id;

comment on view public.v_product_stats is
  'Catálogo con margen, valor de inventario y banderas de reposición. Hereda la RLS de product mediante security_invoker.';
comment on column public.v_product_stats.margin_amount is
  'Ganancia por unidad en la moneda del negocio: price - cost.';
comment on column public.v_product_stats.margin_pct is
  'Margen bruto porcentual (price - cost) / price, redondeado a dos decimales. Null cuando price = 0 porque el margen es indefinido.';
comment on column public.v_product_stats.inventory_value is
  'Valor del stock a costo: cost * stock.';
comment on column public.v_product_stats.retail_value is
  'Valor del stock a precio de venta: price * stock.';
comment on column public.v_product_stats.is_low_stock is
  'Stock bajo según la regla del plan: stock < min_stock, comparación estricta.';
comment on column public.v_product_stats.is_thin_margin is
  'Margen estrecho: margen bruto por debajo del 20 %. Un producto sin precio pero con costo también se marca.';

-- Los grants de la migración de RLS se emitieron con `on all tables` y no
-- alcanzan a los objetos creados después.
revoke all on public.v_product_stats from anon;
grant select on public.v_product_stats to authenticated;

-- Índices para los filtros por categoría y proveedor del inventario.
create index if not exists product_business_category_idx
  on public.product(business_id, category_id);
create index if not exists product_business_supplier_idx
  on public.product(business_id, supplier_id);
