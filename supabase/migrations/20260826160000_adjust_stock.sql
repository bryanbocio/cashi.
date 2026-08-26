-- S2.2 · Ajuste de stock.
-- Las existencias dejan de ser una columna editable a mano: todo cambio manual
-- pasa por `adjust_stock`, que escribe su movimiento en la misma transacción.
-- Sin esto el inventario se puede corregir sin dejar rastro y el histórico de
-- movimientos deja de servir para auditar.

alter table public.stock_movement
  add column if not exists reason text;

comment on column public.stock_movement.reason is
  'Motivo del movimiento. Obligatorio en los ajustes manuales; nulo en los movimientos que generan ventas y compras.';

create or replace function public.adjust_stock(
  p_product uuid,
  p_delta integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_stock integer;
  v_movement uuid;
begin
  select business_id
  into v_business
  from public.product
  where id = p_product;

  if v_business is null then
    raise exception using
      errcode = 'P0002',
      message = 'El producto no existe.';
  end if;

  if not public.is_member(v_business) then
    raise exception using
      errcode = '42501',
      message = 'No tienes acceso a este negocio.';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception using
      errcode = '22023',
      message = 'El ajuste debe ser distinto de cero.';
  end if;

  if v_reason is null then
    raise exception using
      errcode = '22023',
      message = 'Indica el motivo del ajuste.';
  end if;

  -- La suma se resuelve dentro del update para que dos ajustes simultáneos no
  -- se pisen; el stock anterior se deduce del resultado, nunca de una lectura
  -- previa sin bloqueo.
  update public.product
  set stock = stock + p_delta
  where id = p_product
  returning stock into v_stock;

  insert into public.stock_movement (business_id, product_id, type, qty_delta, reason)
  values (v_business, p_product, 'ADJUST', p_delta, v_reason)
  returning id into v_movement;

  return jsonb_build_object(
    'product_id', p_product,
    'previous_stock', v_stock - p_delta,
    'stock', v_stock,
    'qty_delta', p_delta,
    'reason', v_reason,
    'movement_id', v_movement
  );
end;
$$;

comment on function public.adjust_stock(uuid, integer, text) is
  'Corrige las existencias de un producto y registra el movimiento ADJUST. El motivo es obligatorio. El stock resultante puede quedar negativo: la app tolera vender sin existencias.';

revoke all on function public.adjust_stock(uuid, integer, text) from public;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;

-- El stock deja de ser escribible directamente. El resto de columnas del
-- producto se siguen editando desde la interfaz con la RLS de siempre.
revoke update on public.product from authenticated;
grant update (name, sku, category_id, supplier_id, cost, price, min_stock, active)
  on public.product to authenticated;

-- Los movimientos son un registro de auditoría: los miembros los leen, solo
-- las funciones de negocio los escriben.
revoke insert, update, delete on public.stock_movement from authenticated;
