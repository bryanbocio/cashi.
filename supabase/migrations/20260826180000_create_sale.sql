-- S3.1 · Registro de ventas.
-- Todo ocurre en una transacción: se resuelven precio y costo actuales, se
-- congelan en la línea, se descuenta el stock, se escriben los movimientos y se
-- genera el código legible. Cambiar el costo de un producto después de vender
-- no puede alterar la ganancia histórica: por eso la línea guarda su copia.

create or replace function public.create_sale(
  p_business uuid,
  p_customer uuid,
  p_method text,
  p_discount bigint,
  p_due date,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_method public.payment_method;
  v_discount bigint := coalesce(p_discount, 0);
  v_lines jsonb;
  v_line record;
  v_expected integer;
  v_matched integer;
  v_subtotal bigint;
  v_gross bigint;
  v_sale uuid;
  v_code text;
  v_due date;
  v_result jsonb;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión para registrar una venta.';
  end if;

  if not public.is_member(p_business) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este negocio.';
  end if;

  begin
    v_method := upper(trim(coalesce(p_method, '')))::public.payment_method;
  exception
    when invalid_text_representation then
      raise exception using errcode = '22023', message = 'El método de pago no es válido.';
  end;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = '22023', message = 'La venta necesita al menos un producto.';
  end if;

  if v_discount < 0 then
    raise exception using errcode = '22023', message = 'El descuento no puede ser negativo.';
  end if;

  -- Las líneas repetidas del mismo producto se suman: un carrito no tiene dos
  -- renglones del mismo artículo. El orden por producto fija el orden de
  -- bloqueo y evita interbloqueos entre ventas simultáneas.
  begin
    select coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty) order by product_id), '[]'::jsonb)
    into v_lines
    from (
      select (entry.value ->> 'product_id')::uuid as product_id,
             sum(coalesce((entry.value ->> 'qty')::integer, 0)) as qty
      from jsonb_array_elements(p_lines) as entry(value)
      group by 1
    ) grouped;
  exception
    when invalid_text_representation or null_value_not_allowed then
      raise exception using errcode = '22023', message = 'Alguna línea de la venta no tiene un producto o una cantidad válidos.';
  end;

  if exists (
    select 1 from jsonb_to_recordset(v_lines) as x(product_id uuid, qty integer)
    where x.qty is null or x.qty <= 0
  ) then
    raise exception using errcode = '22023', message = 'Cada línea debe llevar una cantidad mayor que cero.';
  end if;

  v_expected := jsonb_array_length(v_lines);
  select count(*) into v_matched
  from jsonb_to_recordset(v_lines) as x(product_id uuid, qty integer)
  join public.product p on p.id = x.product_id
  where p.business_id = p_business and p.active;

  if v_matched <> v_expected then
    raise exception using errcode = 'P0002', message = 'Algún producto de la venta no existe o no está disponible en este negocio.';
  end if;

  if p_customer is not null and not exists (
    select 1 from public.customer c where c.id = p_customer and c.business_id = p_business
  ) then
    raise exception using errcode = 'P0002', message = 'El cliente no existe en este negocio.';
  end if;

  if v_method = 'CREDIT' and p_customer is null then
    raise exception using errcode = '22023', message = 'Una venta a crédito necesita un cliente.';
  end if;

  -- La fecha de vencimiento solo tiene sentido en el fiado.
  v_due := case when v_method = 'CREDIT' then p_due else null end;

  -- Descuento del stock en orden determinista. Vender sin existencias está
  -- permitido: la interfaz avisa, la base no lo impide.
  for v_line in
    select x.product_id, x.qty
    from jsonb_to_recordset(v_lines) as x(product_id uuid, qty integer)
    order by x.product_id
  loop
    update public.product
    set stock = stock - v_line.qty
    where id = v_line.product_id;
  end loop;

  select
    sum(x.qty * p.price),
    sum(x.qty * (p.price - p.cost))
  into v_subtotal, v_gross
  from jsonb_to_recordset(v_lines) as x(product_id uuid, qty integer)
  join public.product p on p.id = x.product_id;

  if v_discount > v_subtotal then
    raise exception using errcode = '22023', message = 'El descuento no puede superar el total de la venta.';
  end if;

  v_code := public.next_doc_code(p_business, 'SALE');

  insert into public.sale (
    business_id, code, customer_id, payment_method, status, total, discount, due_date, created_by
  ) values (
    p_business, v_code, p_customer, v_method, 'CONFIRMED', v_subtotal - v_discount, v_discount, v_due, v_user
  )
  returning id into v_sale;

  -- El precio y el costo quedan congelados en la línea junto al nombre y la
  -- categoría del momento de la venta.
  insert into public.sale_line (
    sale_id, product_id, name_snapshot, category_snapshot, qty, unit_price, unit_cost
  )
  select v_sale, p.id, p.name, c.name, x.qty, p.price, p.cost
  from jsonb_to_recordset(v_lines) as x(product_id uuid, qty integer)
  join public.product p on p.id = x.product_id
  left join public.category c on c.id = p.category_id;

  insert into public.stock_movement (business_id, product_id, type, qty_delta, ref_table, ref_id)
  select p_business, x.product_id, 'SALE', -x.qty, 'sale', v_sale
  from jsonb_to_recordset(v_lines) as x(product_id uuid, qty integer);

  select jsonb_build_object(
    'id', s.id,
    'code', s.code,
    'business_id', s.business_id,
    'customer_id', s.customer_id,
    'payment_method', s.payment_method,
    'status', s.status,
    'subtotal', v_subtotal,
    'discount', s.discount,
    'total', s.total,
    -- El descuento sale del bolsillo del negocio, así que baja la ganancia.
    'gross_profit', v_gross - v_discount,
    'due_date', s.due_date,
    'sold_at', s.sold_at,
    'lines', (
      select jsonb_agg(jsonb_build_object(
        'product_id', l.product_id,
        'name', l.name_snapshot,
        'category', l.category_snapshot,
        'qty', l.qty,
        'unit_price', l.unit_price,
        'unit_cost', l.unit_cost,
        'line_total', l.qty * l.unit_price,
        'line_profit', l.qty * (l.unit_price - l.unit_cost)
      ) order by l.name_snapshot)
      from public.sale_line l where l.sale_id = s.id
    )
  )
  into v_result
  from public.sale s
  where s.id = v_sale;

  return v_result;
end;
$$;

comment on function public.create_sale(uuid, uuid, text, bigint, date, jsonb) is
  'Registra una venta confirmada: congela precio y costo por línea, descuenta stock, escribe movimientos SALE y genera el código FAC-. El descuento resta de la ganancia bruta.';

revoke all on function public.create_sale(uuid, uuid, text, bigint, date, jsonb) from public;
grant execute on function public.create_sale(uuid, uuid, text, bigint, date, jsonb) to authenticated;
