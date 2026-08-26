create extension if not exists pgcrypto with schema extensions;

create type public.membership_role as enum ('OWNER', 'ADMIN', 'CASHIER');
create type public.payment_method as enum ('CASH', 'TRANSFER', 'CARD', 'CREDIT');
create type public.sale_status as enum ('CONFIRMED', 'VOID');
create type public.purchase_status as enum ('PENDING', 'RECEIVED', 'CANCELLED');
create type public.quote_status as enum ('OPEN', 'CONVERTED', 'EXPIRED', 'CANCELLED');
create type public.stock_movement_type as enum ('SALE', 'PURCHASE', 'ADJUST', 'RETURN');
create type public.document_type as enum ('SALE', 'QUOTE', 'PURCHASE');

create table public.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  nit text,
  phone text,
  address text,
  currency text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'America/Bogota',
  logo_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membership (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'OWNER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.category (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.supplier (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sku text not null check (length(trim(sku)) > 0),
  category_id uuid references public.category(id) on delete set null,
  supplier_id uuid references public.supplier(id) on delete set null,
  cost bigint not null default 0 check (cost >= 0),
  price bigint not null default 0 check (price >= 0),
  stock integer not null default 0,
  min_stock integer not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sku)
);

create table public.customer (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  code text not null,
  customer_id uuid references public.customer(id) on delete set null,
  valid_until date not null,
  status public.quote_status not null default 'OPEN',
  total bigint not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create table public.sale (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  code text not null,
  customer_id uuid references public.customer(id) on delete set null,
  payment_method public.payment_method not null,
  status public.sale_status not null default 'CONFIRMED',
  total bigint not null check (total >= 0),
  discount bigint not null default 0 check (discount >= 0),
  due_date date,
  quote_id uuid references public.quote(id) on delete set null,
  sold_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code),
  check (payment_method <> 'CREDIT' or customer_id is not null),
  check (discount <= total + discount)
);

create table public.sale_line (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sale(id) on delete cascade,
  product_id uuid references public.product(id) on delete set null,
  name_snapshot text not null,
  category_snapshot text,
  qty integer not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  unit_cost bigint not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  customer_id uuid not null references public.customer(id) on delete restrict,
  sale_id uuid references public.sale(id) on delete set null,
  amount bigint not null check (amount > 0),
  method public.payment_method not null check (method <> 'CREDIT'),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  concept text not null check (length(trim(concept)) > 0),
  category text not null check (length(trim(category)) > 0),
  amount bigint not null check (amount > 0),
  spent_at date not null default current_date,
  recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_order (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  code text not null,
  supplier_id uuid references public.supplier(id) on delete set null,
  status public.purchase_status not null default 'PENDING',
  expected_at date,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code),
  check (status <> 'RECEIVED' or received_at is not null)
);

create table public.purchase_line (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_order(id) on delete cascade,
  product_id uuid not null references public.product(id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_cost bigint not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, product_id)
);

create table public.quote_line (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote(id) on delete cascade,
  product_id uuid references public.product(id) on delete set null,
  name_snapshot text not null,
  qty integer not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  unit_cost bigint not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_movement (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  product_id uuid not null references public.product(id) on delete restrict,
  type public.stock_movement_type not null,
  qty_delta integer not null check (qty_delta <> 0),
  ref_table text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create table public.doc_sequence (
  business_id uuid not null references public.business(id) on delete cascade,
  doc_type public.document_type not null,
  next_value integer not null default 1 check (next_value > 0),
  primary key (business_id, doc_type)
);

create index membership_user_id_idx on public.membership(user_id);
create index sale_business_sold_at_idx on public.sale(business_id, sold_at);
create index sale_line_sale_id_idx on public.sale_line(sale_id);
create index sale_line_product_id_idx on public.sale_line(product_id);
create index expense_business_spent_at_idx on public.expense(business_id, spent_at);
create index payment_business_customer_idx on public.payment(business_id, customer_id);
create index product_business_active_idx on public.product(business_id, active);
create index quote_business_status_idx on public.quote(business_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profile', 'business', 'membership', 'category', 'supplier', 'product',
    'customer', 'sale', 'sale_line', 'payment', 'expense', 'purchase_order',
    'purchase_line', 'quote', 'quote_line'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;
