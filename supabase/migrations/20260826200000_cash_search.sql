-- S3.3 · Búsqueda de caja y productos frecuentes.
-- La Caja se teclea rápido y a ciegas, así que el orden de los resultados es
-- regla de negocio, no un detalle: primero el SKU exacto, luego lo que empieza
-- por lo tecleado y al final lo que solo lo contiene.

create or replace function public.search_products(
  p_business uuid,
  p_q text,
  p_limit integer default 8
)
returns table (
  id uuid,
  sku text,
  name text,
  category_name text,
  cost bigint,
  price bigint,
  stock integer,
  min_stock integer,
  is_low_stock boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_term text := trim(coalesce(p_q, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
begin
  if not public.is_member(p_business) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este negocio.';
  end if;

  if v_term = '' then
    return;
  end if;

  return query
  select p.id, p.sku, p.name, c.name, p.cost, p.price, p.stock, p.min_stock,
         p.stock < p.min_stock
  from public.product p
  left join public.category c on c.id = p.category_id
  where p.business_id = p_business
    and p.active
    and (p.name ilike '%' || v_term || '%' or p.sku ilike '%' || v_term || '%')
  order by
    case
      when lower(p.sku) = lower(v_term) then 0
      when p.sku ilike v_term || '%' then 1
      when p.name ilike v_term || '%' then 2
      else 3
    end,
    p.name
  limit v_limit;
end;
$$;

comment on function public.search_products(uuid, text, integer) is
  'Busca productos activos por nombre o SKU para la Caja. Ordena por SKU exacto, luego por comienzo y por último por coincidencia parcial. Máximo 20 resultados, 8 por defecto.';

revoke all on function public.search_products(uuid, text, integer) from public;
grant execute on function public.search_products(uuid, text, integer) to authenticated;

-- Los frecuentes salen de lo vendido de verdad: las ventas anuladas no cuentan.
create or replace function public.frequent_products(
  p_business uuid,
  p_limit integer default 8,
  p_days integer default 30
)
returns table (
  id uuid,
  sku text,
  name text,
  category_name text,
  cost bigint,
  price bigint,
  stock integer,
  min_stock integer,
  is_low_stock boolean,
  sold_qty integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.is_member(p_business) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este negocio.';
  end if;

  return query
  select p.id, p.sku, p.name, c.name, p.cost, p.price, p.stock, p.min_stock,
         p.stock < p.min_stock,
         sold.qty
  from (
    select l.product_id, sum(l.qty)::integer as qty
    from public.sale_line l
    join public.sale s on s.id = l.sale_id
    where s.business_id = p_business
      and s.status = 'CONFIRMED'
      and s.sold_at >= now() - make_interval(days => v_days)
      and l.product_id is not null
    group by l.product_id
  ) sold
  join public.product p on p.id = sold.product_id
  left join public.category c on c.id = p.category_id
  where p.business_id = p_business and p.active
  order by sold.qty desc, p.name
  limit v_limit;
end;
$$;

comment on function public.frequent_products(uuid, integer, integer) is
  'Productos más vendidos de los últimos días (30 por defecto), contando solo ventas CONFIRMED. Alimenta los botones de acceso rápido de la Caja.';

revoke all on function public.frequent_products(uuid, integer, integer) from public;
grant execute on function public.frequent_products(uuid, integer, integer) to authenticated;

-- La consulta de frecuentes agrupa por producto sobre las líneas de venta del
-- negocio; este índice evita recorrer todas las líneas históricas.
create index if not exists sale_business_status_sold_at_idx
  on public.sale(business_id, status, sold_at);
