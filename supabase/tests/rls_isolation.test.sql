begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

-- A second tenant with one row in every tenant-owned table.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'tenant-b@cashi.local',
  crypt('TenantB2026!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
);

insert into public.profile (id, full_name)
values ('10000000-0000-0000-0000-000000000002', 'Usuario B');

insert into public.business (id, name, created_by)
values (
  '20000000-0000-0000-0000-000000000002', 'Negocio B',
  '10000000-0000-0000-0000-000000000002'
);

insert into public.membership (id, business_id, user_id, role)
values (
  '21000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002', 'OWNER'
);

insert into public.category (id, business_id, name)
values (
  '30000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002', 'Categoría B'
);

insert into public.supplier (id, business_id, name)
values (
  '40000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002', 'Proveedor B'
);

insert into public.product (
  id, business_id, name, sku, category_id, supplier_id, cost, price, stock, min_stock
) values (
  '50000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002', 'Producto B', 'B-001',
  '30000000-0000-0000-0000-000000000012',
  '40000000-0000-0000-0000-000000000012', 1000, 2000, 5, 1
);

insert into public.customer (id, business_id, name)
values (
  '60000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002', 'Cliente B'
);

insert into public.quote (id, business_id, code, customer_id, valid_until, total)
values (
  '70000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002', 'COT-B-001',
  '60000000-0000-0000-0000-000000000012', current_date + 7, 2000
);

insert into public.quote_line (
  id, quote_id, product_id, name_snapshot, qty, unit_price, unit_cost
) values (
  '71000000-0000-0000-0000-000000000012',
  '70000000-0000-0000-0000-000000000012',
  '50000000-0000-0000-0000-000000000012', 'Producto B', 1, 2000, 1000
);

insert into public.sale (
  id, business_id, code, customer_id, payment_method, total, created_by
) values (
  '80000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002', 'FAC-B-001',
  '60000000-0000-0000-0000-000000000012', 'CASH', 2000,
  '10000000-0000-0000-0000-000000000002'
);

insert into public.sale_line (
  id, sale_id, product_id, name_snapshot, category_snapshot, qty, unit_price, unit_cost
) values (
  '81000000-0000-0000-0000-000000000012',
  '80000000-0000-0000-0000-000000000012',
  '50000000-0000-0000-0000-000000000012', 'Producto B', 'Categoría B', 1, 2000, 1000
);

insert into public.payment (id, business_id, customer_id, sale_id, amount, method)
values (
  '82000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000012',
  '80000000-0000-0000-0000-000000000012', 500, 'CASH'
);

insert into public.expense (id, business_id, concept, category, amount)
values (
  '83000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002', 'Gasto B', 'Otros', 300
);

insert into public.purchase_order (
  id, business_id, code, supplier_id, expected_at
) values (
  '90000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002', 'OC-B-001',
  '40000000-0000-0000-0000-000000000012', current_date + 3
);

insert into public.purchase_line (
  id, purchase_order_id, product_id, qty, unit_cost
) values (
  '91000000-0000-0000-0000-000000000012',
  '90000000-0000-0000-0000-000000000012',
  '50000000-0000-0000-0000-000000000012', 2, 900
);

insert into public.stock_movement (
  id, business_id, product_id, type, qty_delta, ref_table, ref_id
) values (
  '92000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000012', 'ADJUST', 5, 'seed', null
);

insert into public.doc_sequence (business_id, doc_type, next_value)
values ('20000000-0000-0000-0000-000000000002', 'SALE', 2);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(public.is_member('20000000-0000-0000-0000-000000000001'), 'A is a member of business A');
select isnt(public.is_member('20000000-0000-0000-0000-000000000002'), true, 'A is not a member of business B');

select is((select count(*) from public.profile where id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'profile B is hidden');
select is((select count(*) from public.business where id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'business B is hidden');
select is((select count(*) from public.membership where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'membership B is hidden');
select is((select count(*) from public.category where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'category B is hidden');
select is((select count(*) from public.supplier where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'supplier B is hidden');
select is((select count(*) from public.product where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'product B is hidden');
select is((select count(*) from public.customer where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'customer B is hidden');
select is((select count(*) from public.sale where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'sale B is hidden');
select is((select count(*) from public.sale_line where sale_id = '80000000-0000-0000-0000-000000000012'), 0::bigint, 'sale line B is hidden');
select is((select count(*) from public.payment where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'payment B is hidden');
select is((select count(*) from public.expense where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'expense B is hidden');
select is((select count(*) from public.purchase_order where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'purchase order B is hidden');
select is((select count(*) from public.purchase_line where purchase_order_id = '90000000-0000-0000-0000-000000000012'), 0::bigint, 'purchase line B is hidden');
select is((select count(*) from public.quote where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'quote B is hidden');
select is((select count(*) from public.quote_line where quote_id = '70000000-0000-0000-0000-000000000012'), 0::bigint, 'quote line B is hidden');
select is((select count(*) from public.stock_movement where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'stock movement B is hidden');
select is((select count(*) from public.doc_sequence where business_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'document sequence B is hidden');

select throws_ok(
  $$insert into public.product (business_id, name, sku) values ('20000000-0000-0000-0000-000000000002', 'Intruso', 'HACK-1')$$,
  '42501',
  'new row violates row-level security policy for table "product"',
  'A cannot insert a product into business B'
);

select * from finish();
rollback;
