-- S6.2 · Conversión de cotizaciones.
-- La fila de la cotización se bloquea antes de crear la venta. Así, dos
-- solicitudes simultáneas esperan el mismo candado y ambas terminan apuntando
-- a una sola venta, sin descontar stock ni escribir movimientos dos veces.

create unique index if not exists sale_quote_id_unique_idx
  on public.sale (quote_id)
  where quote_id is not null;

create or replace function public.convert_quote(
  p_quote uuid,
  p_method text,
  p_due date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
  v_customer uuid;
  v_quote_code text;
  v_quote_status public.quote_status;
  v_method public.payment_method;
  v_lines jsonb;
  v_sale uuid;
  v_result jsonb;
begin
  if v_user is null then
    raise exception using
      errcode = '42501',
      message = 'Debes iniciar sesión para convertir una cotización.';
  end if;

  select q.business_id, q.customer_id, q.code, q.status
  into v_business, v_customer, v_quote_code, v_quote_status
  from public.quote q
  where q.id = p_quote
  for update;

  if v_business is null then
    raise exception using
      errcode = 'P0002',
      message = 'La cotización no existe.';
  end if;

  if not public.is_member(v_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  -- Un reintento de una conversión ya confirmada devuelve la venta original.
  -- El índice único garantiza además que una cotización nunca tenga dos ventas.
  if v_quote_status = 'CONVERTED' then
    select s.id
    into v_sale
    from public.sale s
    where s.quote_id = p_quote;

    if v_sale is null then
      raise exception using
        errcode = 'P0002',
        message = 'La cotización figura convertida, pero su venta no existe.';
    end if;
  elsif v_quote_status <> 'OPEN' then
    raise exception using
      errcode = '22023',
      message = 'Solo una cotización abierta se puede convertir.';
  else
    begin
      v_method := upper(trim(coalesce(p_method, '')))::public.payment_method;
    exception
      when invalid_text_representation then
        raise exception using
          errcode = '22023',
          message = 'El método de pago no es válido.';
    end;

    if v_method = 'CREDIT' and v_customer is null then
      raise exception using
        errcode = '22023',
        message = 'Una cotización a crédito necesita un cliente.';
    end if;

    if not exists (
      select 1 from public.quote_line ql where ql.quote_id = p_quote
    ) then
      raise exception using
        errcode = '22023',
        message = 'La cotización necesita al menos un producto.';
    end if;

    if exists (
      select 1
      from public.quote_line ql
      where ql.quote_id = p_quote
        and ql.product_id is null
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'Algún producto de la cotización ya no existe.';
    end if;

    select jsonb_agg(
      jsonb_build_object('product_id', ql.product_id, 'qty', ql.qty)
      order by ql.product_id
    )
    into v_lines
    from public.quote_line ql
    where ql.quote_id = p_quote;

    -- create_sale resuelve los valores vigentes, descuenta stock en orden UUID,
    -- crea movimientos SALE y conserva p_due únicamente cuando es fiado.
    v_result := public.create_sale(
      v_business,
      v_customer,
      v_method::text,
      0,
      p_due,
      v_lines
    );
    v_sale := (v_result ->> 'id')::uuid;

    update public.sale
    set quote_id = p_quote
    where id = v_sale;

    update public.quote
    set status = 'CONVERTED'
    where id = p_quote;
  end if;

  -- Se reconstruye desde las tablas para que la primera llamada y cualquier
  -- reintento devuelvan exactamente el mismo contrato.
  select jsonb_build_object(
    'id', s.id,
    'code', s.code,
    'business_id', s.business_id,
    'customer_id', s.customer_id,
    'payment_method', s.payment_method,
    'status', s.status,
    'subtotal', s.total + s.discount,
    'discount', s.discount,
    'total', s.total,
    'gross_profit', coalesce(l.gross_profit, 0) - s.discount,
    'due_date', s.due_date,
    'sold_at', s.sold_at,
    'quote_id', p_quote,
    'quote_code', v_quote_code,
    'lines', coalesce(l.lines, '[]'::jsonb)
  )
  into v_result
  from public.sale s
  left join lateral (
    select
      sum(sl.qty * (sl.unit_price - sl.unit_cost))::bigint as gross_profit,
      jsonb_agg(jsonb_build_object(
        'product_id', sl.product_id,
        'name', sl.name_snapshot,
        'category', sl.category_snapshot,
        'qty', sl.qty,
        'unit_price', sl.unit_price,
        'unit_cost', sl.unit_cost,
        'line_total', sl.qty * sl.unit_price,
        'line_profit', sl.qty * (sl.unit_price - sl.unit_cost)
      ) order by sl.name_snapshot, sl.id) as lines
    from public.sale_line sl
    where sl.sale_id = s.id
  ) l on true
  where s.id = v_sale;

  return v_result;
end;
$$;

comment on function public.convert_quote(uuid, text, date) is
  'Convierte una cotización OPEN mediante create_sale, enlaza la venta y marca CONVERTED. Los reintentos devuelven la misma venta sin repetir efectos.';

revoke all on function public.convert_quote(uuid, text, date) from public, anon;
grant execute on function public.convert_quote(uuid, text, date) to authenticated;
