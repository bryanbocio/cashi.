-- S2.3 · Importación de productos.
-- La Edge Function se encarga del CSV (parseo, encabezados, errores por fila),
-- que es lo que SQL hace mal. La escritura vive aquí: así el import entra en una
-- sola transacción, resuelve categorías y proveedores por nombre y respeta la
-- regla de S2.2 de que el stock no se toca sin movimiento.

create or replace function public.import_products(
  p_business uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_sku text;
  v_name text;
  v_category_name text;
  v_supplier_name text;
  v_category uuid;
  v_supplier uuid;
  v_existing uuid;
  v_stock integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_stock_ignored integer := 0;
begin
  if not public.is_member(p_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'El listado de productos no es válido.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) as entry(value) loop
    v_sku := nullif(trim(coalesce(v_row ->> 'sku', '')), '');
    v_name := nullif(trim(coalesce(v_row ->> 'name', '')), '');

    if v_sku is null or v_name is null then
      raise exception using
        errcode = '22023',
        message = 'Cada producto necesita SKU y nombre.';
    end if;

    -- El catálogo lo define el usuario: si la categoría o el proveedor no
    -- existen se crean en la misma transacción.
    v_category_name := nullif(trim(coalesce(v_row ->> 'category', '')), '');
    v_category := null;
    if v_category_name is not null then
      select id into v_category
      from public.category
      where business_id = p_business and lower(name) = lower(v_category_name)
      limit 1;

      if v_category is null then
        insert into public.category (business_id, name)
        values (p_business, v_category_name)
        returning id into v_category;
      end if;
    end if;

    v_supplier_name := nullif(trim(coalesce(v_row ->> 'supplier', '')), '');
    v_supplier := null;
    if v_supplier_name is not null then
      select id into v_supplier
      from public.supplier
      where business_id = p_business and lower(name) = lower(v_supplier_name)
      limit 1;

      if v_supplier is null then
        insert into public.supplier (business_id, name)
        values (p_business, v_supplier_name)
        returning id into v_supplier;
      end if;
    end if;

    select id into v_existing
    from public.product
    where business_id = p_business and lower(sku) = lower(v_sku)
    limit 1;

    if v_existing is null then
      -- Solo al crear se fija el stock inicial.
      insert into public.product (
        business_id, sku, name, category_id, supplier_id, cost, price, stock, min_stock
      ) values (
        p_business,
        v_sku,
        v_name,
        v_category,
        v_supplier,
        coalesce((v_row ->> 'cost')::bigint, 0),
        coalesce((v_row ->> 'price')::bigint, 0),
        coalesce((v_row ->> 'stock')::integer, 0),
        coalesce((v_row ->> 'min_stock')::integer, 0)
      );
      v_created := v_created + 1;
    else
      update public.product
      set name = v_name,
          category_id = v_category,
          supplier_id = v_supplier,
          cost = coalesce((v_row ->> 'cost')::bigint, 0),
          price = coalesce((v_row ->> 'price')::bigint, 0),
          min_stock = coalesce((v_row ->> 'min_stock')::integer, 0)
      where id = v_existing;
      v_updated := v_updated + 1;

      -- El archivo traía existencias para un producto que ya existe: se ignoran
      -- y se informa, porque cambiarlas exige `adjust_stock`.
      v_stock := coalesce((v_row ->> 'stock')::integer, 0);
      if v_stock <> 0 then
        v_stock_ignored := v_stock_ignored + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'stock_ignored', v_stock_ignored
  );
end;
$$;

comment on function public.import_products(uuid, jsonb) is
  'Alta y actualización masiva de productos por SKU en una sola transacción. Crea categorías y proveedores que falten. Nunca modifica el stock de un producto existente.';

revoke all on function public.import_products(uuid, jsonb) from public;
grant execute on function public.import_products(uuid, jsonb) to authenticated;
