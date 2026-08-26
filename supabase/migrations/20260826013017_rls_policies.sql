-- Helpers execute as their owner so membership checks do not recurse through
-- membership's own row-level policies.
create or replace function public.is_member(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.membership m
    where m.business_id = p_business
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_business_role(
  p_business uuid,
  p_roles public.membership_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.membership m
    where m.business_id = p_business
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

revoke all on function public.is_member(uuid) from public;
revoke all on function public.has_business_role(uuid, public.membership_role[]) from public;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, public.membership_role[]) to authenticated;

alter table public.profile enable row level security;
alter table public.business enable row level security;
alter table public.membership enable row level security;
alter table public.category enable row level security;
alter table public.supplier enable row level security;
alter table public.product enable row level security;
alter table public.customer enable row level security;
alter table public.sale enable row level security;
alter table public.sale_line enable row level security;
alter table public.payment enable row level security;
alter table public.expense enable row level security;
alter table public.purchase_order enable row level security;
alter table public.purchase_line enable row level security;
alter table public.quote enable row level security;
alter table public.quote_line enable row level security;
alter table public.stock_movement enable row level security;
alter table public.doc_sequence enable row level security;

-- Supabase no expone tablas nuevas automáticamente. El rol autenticado recibe
-- permisos SQL y las políticas siguientes limitan las filas accesibles.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

create policy "profile select own"
on public.profile for select to authenticated
using (id = auth.uid());

create policy "profile insert own"
on public.profile for insert to authenticated
with check (id = auth.uid());

create policy "profile update own"
on public.profile for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profile delete own"
on public.profile for delete to authenticated
using (id = auth.uid());

create policy "business select member"
on public.business for select to authenticated
using (public.is_member(id));

create policy "business insert authenticated"
on public.business for insert to authenticated
with check (created_by = auth.uid());

create policy "business update owner"
on public.business for update to authenticated
using (public.has_business_role(id, array['OWNER']::public.membership_role[]))
with check (public.has_business_role(id, array['OWNER']::public.membership_role[]));

create policy "business delete owner"
on public.business for delete to authenticated
using (public.has_business_role(id, array['OWNER']::public.membership_role[]));

create policy "membership select permitted"
on public.membership for select to authenticated
using (
  user_id = auth.uid()
  or public.has_business_role(
    business_id,
    array['OWNER', 'ADMIN']::public.membership_role[]
  )
);

create policy "membership insert owner"
on public.membership for insert to authenticated
with check (
  public.has_business_role(
    business_id,
    array['OWNER']::public.membership_role[]
  )
);

create policy "membership update owner"
on public.membership for update to authenticated
using (
  public.has_business_role(
    business_id,
    array['OWNER']::public.membership_role[]
  )
)
with check (
  public.has_business_role(
    business_id,
    array['OWNER']::public.membership_role[]
  )
);

create policy "membership delete owner"
on public.membership for delete to authenticated
using (
  public.has_business_role(
    business_id,
    array['OWNER']::public.membership_role[]
  )
);

-- Tables whose tenant key is stored directly on the row.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'category', 'supplier', 'product', 'customer', 'sale', 'payment',
    'expense', 'purchase_order', 'quote', 'stock_movement', 'doc_sequence'
  ] loop
    execute format(
      'create policy "select own business" on public.%I for select to authenticated using (public.is_member(business_id))',
      table_name
    );
    execute format(
      'create policy "insert own business" on public.%I for insert to authenticated with check (public.is_member(business_id))',
      table_name
    );
    execute format(
      'create policy "update own business" on public.%I for update to authenticated using (public.is_member(business_id)) with check (public.is_member(business_id))',
      table_name
    );
    execute format(
      'create policy "delete own business" on public.%I for delete to authenticated using (public.is_member(business_id))',
      table_name
    );
  end loop;
end;
$$;

create policy "sale line select own business"
on public.sale_line for select to authenticated
using (
  exists (
    select 1 from public.sale s
    where s.id = sale_id and public.is_member(s.business_id)
  )
);

create policy "sale line insert own business"
on public.sale_line for insert to authenticated
with check (
  exists (
    select 1 from public.sale s
    where s.id = sale_id and public.is_member(s.business_id)
  )
);

create policy "sale line update own business"
on public.sale_line for update to authenticated
using (
  exists (
    select 1 from public.sale s
    where s.id = sale_id and public.is_member(s.business_id)
  )
)
with check (
  exists (
    select 1 from public.sale s
    where s.id = sale_id and public.is_member(s.business_id)
  )
);

create policy "sale line delete own business"
on public.sale_line for delete to authenticated
using (
  exists (
    select 1 from public.sale s
    where s.id = sale_id and public.is_member(s.business_id)
  )
);

create policy "quote line select own business"
on public.quote_line for select to authenticated
using (
  exists (
    select 1 from public.quote q
    where q.id = quote_id and public.is_member(q.business_id)
  )
);

create policy "quote line insert own business"
on public.quote_line for insert to authenticated
with check (
  exists (
    select 1 from public.quote q
    where q.id = quote_id and public.is_member(q.business_id)
  )
);

create policy "quote line update own business"
on public.quote_line for update to authenticated
using (
  exists (
    select 1 from public.quote q
    where q.id = quote_id and public.is_member(q.business_id)
  )
)
with check (
  exists (
    select 1 from public.quote q
    where q.id = quote_id and public.is_member(q.business_id)
  )
);

create policy "quote line delete own business"
on public.quote_line for delete to authenticated
using (
  exists (
    select 1 from public.quote q
    where q.id = quote_id and public.is_member(q.business_id)
  )
);

create policy "purchase line select own business"
on public.purchase_line for select to authenticated
using (
  exists (
    select 1 from public.purchase_order po
    where po.id = purchase_order_id and public.is_member(po.business_id)
  )
);

create policy "purchase line insert own business"
on public.purchase_line for insert to authenticated
with check (
  exists (
    select 1 from public.purchase_order po
    where po.id = purchase_order_id and public.is_member(po.business_id)
  )
);

create policy "purchase line update own business"
on public.purchase_line for update to authenticated
using (
  exists (
    select 1 from public.purchase_order po
    where po.id = purchase_order_id and public.is_member(po.business_id)
  )
)
with check (
  exists (
    select 1 from public.purchase_order po
    where po.id = purchase_order_id and public.is_member(po.business_id)
  )
);

create policy "purchase line delete own business"
on public.purchase_line for delete to authenticated
using (
  exists (
    select 1 from public.purchase_order po
    where po.id = purchase_order_id and public.is_member(po.business_id)
  )
);
