-- Usuario local: demo@cashi.local / CashiDemo2026!
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'demo@cashi.local',
  crypt('CashiDemo2026!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Usuario Demo"}', now(), now(), '', '', '', ''
);

-- Usuarios auxiliares para probar middleware y aislamiento entre negocios.
-- Sin negocio: onboarding@cashi.local / CashiOnboarding2026!
-- Otro tenant: other@cashi.local / CashiOther2026!
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000010',
    'authenticated', 'authenticated', 'onboarding@cashi.local',
    crypt('CashiOnboarding2026!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Usuario Onboarding"}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000011',
    'authenticated', 'authenticated', 'other@cashi.local',
    crypt('CashiOther2026!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Usuario Otro Negocio"}', now(), now(), '', '', '', ''
  );

update public.profile
set phone = '3000000000'
where id = '10000000-0000-0000-0000-000000000001';

insert into public.business (id, name, nit, phone, address, created_by)
values (
  '20000000-0000-0000-0000-000000000001', 'Cashi Demo', '900123456-7',
  '6015550101', 'Calle 10 # 20-30', '10000000-0000-0000-0000-000000000001'
);

insert into public.membership (business_id, user_id, role)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'OWNER'
);

insert into public.business (id, name, created_by)
values (
  '20000000-0000-0000-0000-000000000010',
  'Negocio Ajeno de Prueba',
  '10000000-0000-0000-0000-000000000011'
);

insert into public.membership (business_id, user_id, role)
values (
  '20000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000011',
  'OWNER'
);

insert into public.category (id, business_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Perfumería'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Cuidado personal'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Accesorios');

insert into public.supplier (id, business_id, name, phone) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Distribuciones Central', '3105550101'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Comercializadora Norte', '3105550102');

insert into public.product (
  id, business_id, name, sku, category_id, supplier_id, cost, price, stock, min_stock
) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Perfume Aurora 50 ml', 'PER-001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 48000, 79000, 12, 4),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Perfume Noche 100 ml', 'PER-002', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 72000, 119000, 6, 3),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Crema corporal 250 ml', 'CUI-001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 18000, 32000, 18, 5),
  ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Jabón facial', 'CUI-002', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 9500, 18000, 3, 5),
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Desodorante roll-on', 'CUI-003', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 8000, 14500, 20, 6),
  ('50000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'Set de brochas', 'ACC-001', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 25000, 45000, 4, 4),
  ('50000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'Cosmetiquera', 'ACC-002', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 15000, 29000, 10, 3),
  ('50000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 'Espejo compacto', 'ACC-003', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 7000, 13000, 2, 4);

insert into public.customer (id, business_id, name, phone) values
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Ana Pérez', '3205550101'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Carlos Gómez', '3205550102'),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Diana Ruiz', '3205550103'),
  ('60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Luis Torres', '3205550104'),
  ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'María López', '3205550105');

insert into public.doc_sequence (business_id, doc_type, next_value) values
  ('20000000-0000-0000-0000-000000000001', 'SALE', 1),
  ('20000000-0000-0000-0000-000000000001', 'QUOTE', 1),
  ('20000000-0000-0000-0000-000000000001', 'PURCHASE', 1);
