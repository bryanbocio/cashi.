-- S4.2 · Fiados.
-- Los abonos son generales por cliente. Para saber qué factura sigue
-- pendiente se aplican primero a las ventas con vencimiento más antiguo.

create or replace function private.credit_is_overdue_at(
  p_due_date date,
  p_timezone text,
  p_now timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_due_date < (p_now at time zone p_timezone)::date, false);
$$;

create or replace view public.v_credits
with (security_invoker = true) as
with credit_sales as (
  select
    s.id,
    s.business_id,
    s.customer_id,
    s.total,
    s.due_date,
    s.sold_at,
    sum(s.total) over (
      partition by s.business_id, s.customer_id
      order by s.due_date nulls last, s.sold_at, s.id
      rows between unbounded preceding and current row
    ) as running_credit
  from public.sale s
  where s.payment_method = 'CREDIT'
    and s.status = 'CONFIRMED'
),
payment_totals as (
  select
    p.business_id,
    p.customer_id,
    sum(p.amount)::bigint as total_paid,
    max(p.paid_at) as last_payment_at
  from public.payment p
  group by p.business_id, p.customer_id
),
credit_totals as (
  select
    s.business_id,
    s.customer_id,
    sum(s.total)::bigint as total_credit,
    count(*)::integer as credit_sales_count,
    max(s.sold_at) as last_credit_at,
    min(s.due_date) filter (
      where s.running_credit > coalesce(p.total_paid, 0)
    ) as oldest_due_date
  from credit_sales s
  left join payment_totals p
    on p.business_id = s.business_id and p.customer_id = s.customer_id
  group by s.business_id, s.customer_id, p.total_paid
)
select
  c.id as customer_id,
  c.business_id,
  c.name as customer_name,
  c.phone as customer_phone,
  t.total_credit,
  coalesce(p.total_paid, 0)::bigint as total_paid,
  (t.total_credit - coalesce(p.total_paid, 0))::bigint as debt,
  t.credit_sales_count,
  t.oldest_due_date,
  private.credit_is_overdue_at(t.oldest_due_date, b.timezone, current_timestamp) as is_overdue,
  case
    when private.credit_is_overdue_at(t.oldest_due_date, b.timezone, current_timestamp)
      then ((current_timestamp at time zone b.timezone)::date - t.oldest_due_date)::integer
    else 0
  end as days_overdue,
  t.last_credit_at,
  p.last_payment_at
from credit_totals t
join public.customer c
  on c.id = t.customer_id and c.business_id = t.business_id
join public.business b on b.id = t.business_id
left join payment_totals p
  on p.business_id = t.business_id and p.customer_id = t.customer_id
where t.total_credit > coalesce(p.total_paid, 0);

comment on view public.v_credits is
  'Una fila por cliente con deuda: crédito confirmado menos abonos. Los abonos cubren primero las ventas con vencimiento más antiguo; el vencimiento usa la fecha local del negocio.';

revoke all on public.v_credits from anon;
grant select on public.v_credits to authenticated;

-- La comprobación también protege operaciones futuras que reduzcan el crédito,
-- por ejemplo anular una venta que ya recibió abonos.
create or replace function private.assert_nonnegative_credit_balance(
  p_business uuid,
  p_customer uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credit bigint;
  v_paid bigint;
begin
  if p_business is null or p_customer is null then
    return;
  end if;

  -- El mismo bloqueo que toma register_payment serializa toda comprobación del
  -- saldo de este cliente dentro del negocio.
  perform 1
  from public.customer c
  where c.id = p_customer and c.business_id = p_business
  for update;

  select coalesce(sum(s.total), 0)::bigint
  into v_credit
  from public.sale s
  where s.business_id = p_business
    and s.customer_id = p_customer
    and s.payment_method = 'CREDIT'
    and s.status = 'CONFIRMED';

  select coalesce(sum(p.amount), 0)::bigint
  into v_paid
  from public.payment p
  where p.business_id = p_business and p.customer_id = p_customer;

  if v_paid > v_credit then
    raise exception using
      errcode = '23514',
      message = 'La operación dejaría la deuda del cliente en negativo.';
  end if;
end;
$$;

create or replace function private.check_payment_credit_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.assert_nonnegative_credit_balance(old.business_id, old.customer_id);
  end if;

  if tg_op = 'INSERT' then
    perform private.assert_nonnegative_credit_balance(new.business_id, new.customer_id);
  elsif tg_op = 'UPDATE'
        and (new.business_id, new.customer_id) is distinct from (old.business_id, old.customer_id) then
    perform private.assert_nonnegative_credit_balance(new.business_id, new.customer_id);
  end if;

  return null;
end;
$$;

create trigger check_payment_credit_balance
after insert or update or delete on public.payment
for each row execute function private.check_payment_credit_balance();

create or replace function private.check_sale_credit_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.payment_method = 'CREDIT' then
    perform private.assert_nonnegative_credit_balance(old.business_id, old.customer_id);
  end if;

  if tg_op = 'INSERT' and new.payment_method = 'CREDIT' then
    perform private.assert_nonnegative_credit_balance(new.business_id, new.customer_id);
  elsif tg_op = 'UPDATE' and new.payment_method = 'CREDIT'
        and (new.business_id, new.customer_id) is distinct from (old.business_id, old.customer_id) then
    perform private.assert_nonnegative_credit_balance(new.business_id, new.customer_id);
  end if;

  return null;
end;
$$;

create trigger check_sale_credit_balance
after insert or update or delete on public.sale
for each row execute function private.check_sale_credit_balance();

create or replace function public.register_payment(
  p_business uuid,
  p_customer uuid,
  p_amount bigint,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_method public.payment_method;
  v_amount bigint := coalesce(p_amount, 0);
  v_customer uuid;
  v_credit bigint;
  v_paid bigint;
  v_previous_debt bigint;
  v_payment public.payment%rowtype;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión para registrar un abono.';
  end if;

  if not public.is_member(p_business) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este negocio.';
  end if;

  if v_amount <= 0 then
    raise exception using errcode = '22023', message = 'El abono debe ser mayor que cero.';
  end if;

  begin
    v_method := upper(trim(coalesce(p_method, '')))::public.payment_method;
  exception
    when invalid_text_representation then
      raise exception using errcode = '22023', message = 'El método de pago no es válido.';
  end;

  if v_method = 'CREDIT' then
    raise exception using errcode = '22023', message = 'Un abono no puede registrarse como fiado.';
  end if;

  -- Bloquear el cliente antes de leer ventas y abonos hace que dos llamadas
  -- simultáneas vean el saldo dejado por la anterior.
  select c.id
  into v_customer
  from public.customer c
  where c.id = p_customer and c.business_id = p_business
  for update;

  if v_customer is null then
    raise exception using errcode = 'P0002', message = 'El cliente no existe en este negocio.';
  end if;

  select coalesce(sum(s.total), 0)::bigint
  into v_credit
  from public.sale s
  where s.business_id = p_business
    and s.customer_id = p_customer
    and s.payment_method = 'CREDIT'
    and s.status = 'CONFIRMED';

  select coalesce(sum(p.amount), 0)::bigint
  into v_paid
  from public.payment p
  where p.business_id = p_business and p.customer_id = p_customer;

  v_previous_debt := v_credit - v_paid;

  if v_previous_debt <= 0 then
    raise exception using errcode = '22023', message = 'El cliente no tiene deuda pendiente.';
  end if;

  if v_amount > v_previous_debt then
    raise exception using errcode = '22023', message = 'El abono no puede superar la deuda pendiente.';
  end if;

  insert into public.payment (business_id, customer_id, amount, method)
  values (p_business, p_customer, v_amount, v_method)
  returning * into v_payment;

  return jsonb_build_object(
    'id', v_payment.id,
    'business_id', v_payment.business_id,
    'customer_id', v_payment.customer_id,
    'amount', v_payment.amount,
    'method', v_payment.method,
    'paid_at', v_payment.paid_at,
    'previous_debt', v_previous_debt,
    'debt', v_previous_debt - v_payment.amount
  );
end;
$$;

comment on function public.register_payment(uuid, uuid, bigint, text) is
  'Registra un abono general al fiado del cliente. Bloquea al cliente para impedir sobreabonos concurrentes y devuelve la deuda anterior y restante.';

revoke all on function public.register_payment(uuid, uuid, bigint, text) from public;
grant execute on function public.register_payment(uuid, uuid, bigint, text) to authenticated;

-- Los abonos son un registro auditable y solo se crean mediante la RPC.
revoke insert, update, delete on public.payment from authenticated;

create index if not exists sale_business_customer_credit_idx
  on public.sale(business_id, customer_id, due_date, sold_at)
  where payment_method = 'CREDIT' and status = 'CONFIRMED';
