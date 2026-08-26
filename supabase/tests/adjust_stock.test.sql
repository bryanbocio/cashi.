begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

-- Producto de un negocio ajeno para comprobar el aislamiento.
insert into public.product (
  id, business_id, name, sku, cost, price, stock, min_stock
) values
  ('56000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010', 'Producto Ajeno', 'AJE-001', 1000, 2000, 7, 0);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Alta: PER-001 arranca con 12 unidades en el seed.
select is(
  (select public.adjust_stock('50000000-0000-0000-0000-000000000001', 5, 'Conteo físico') ->> 'stock')::integer,
  17,
  'a positive adjustment increases the stock'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000001'),
  17,
  'the product row holds the new stock'
);

select is(
  (select count(*) from public.stock_movement
   where product_id = '50000000-0000-0000-0000-000000000001' and type = 'ADJUST'),
  1::bigint,
  'the adjustment writes one movement'
);

select is(
  (select qty_delta from public.stock_movement
   where product_id = '50000000-0000-0000-0000-000000000001' and type = 'ADJUST'),
  5,
  'the movement stores the delta'
);

select is(
  (select reason from public.stock_movement
   where product_id = '50000000-0000-0000-0000-000000000001' and type = 'ADJUST'),
  'Conteo físico',
  'the movement stores the reason'
);

select is(
  (select business_id from public.stock_movement
   where product_id = '50000000-0000-0000-0000-000000000001' and type = 'ADJUST'),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'the movement belongs to the product business'
);

-- Baja: CUI-001 arranca con 18 unidades.
select is(
  (select public.adjust_stock('50000000-0000-0000-0000-000000000003', -6, 'Merma') ->> 'stock')::integer,
  12,
  'a negative adjustment decreases the stock'
);

select is(
  (select public.adjust_stock('50000000-0000-0000-0000-000000000003', -2, 'Merma') ->> 'previous_stock')::integer,
  12,
  'the payload reports the stock before the adjustment'
);

select is(
  (select stock from public.product where id = '50000000-0000-0000-0000-000000000003'),
  10,
  'consecutive adjustments accumulate'
);

select is(
  (select count(*) from public.stock_movement
   where product_id = '50000000-0000-0000-0000-000000000003'),
  2::bigint,
  'each adjustment writes its own movement'
);

-- El stock puede quedar negativo: la app tolera vender sin existencias.
select is(
  (select public.adjust_stock('50000000-0000-0000-0000-000000000008', -5, 'Corrección de conteo') ->> 'stock')::integer,
  -3,
  'an adjustment may leave the stock negative'
);

select ok(
  (select (public.adjust_stock('50000000-0000-0000-0000-000000000007', 1, 'Devolución') ->> 'movement_id') is not null),
  'the payload returns the movement id'
);

-- Validaciones.
select throws_ok(
  $$select public.adjust_stock('50000000-0000-0000-0000-000000000001', 0, 'Sin efecto')$$,
  '22023',
  'El ajuste debe ser distinto de cero.',
  'a zero adjustment is rejected'
);

select throws_ok(
  $$select public.adjust_stock('50000000-0000-0000-0000-000000000001', null, 'Sin cantidad')$$,
  '22023',
  'El ajuste debe ser distinto de cero.',
  'a null adjustment is rejected'
);

select throws_ok(
  $$select public.adjust_stock('50000000-0000-0000-0000-000000000001', 3, '')$$,
  '22023',
  'Indica el motivo del ajuste.',
  'an empty reason is rejected'
);

select throws_ok(
  $$select public.adjust_stock('50000000-0000-0000-0000-000000000001', 3, '   ')$$,
  '22023',
  'Indica el motivo del ajuste.',
  'a blank reason is rejected'
);

select throws_ok(
  $$select public.adjust_stock('50000000-0000-0000-0000-000000000001', 3, null)$$,
  '22023',
  'Indica el motivo del ajuste.',
  'a null reason is rejected'
);

select throws_ok(
  $$select public.adjust_stock('59000000-0000-0000-0000-000000000099', 3, 'Conteo físico')$$,
  'P0002',
  'El producto no existe.',
  'adjusting a missing product is rejected'
);

select throws_ok(
  $$select public.adjust_stock('56000000-0000-0000-0000-000000000001', 3, 'Conteo físico')$$,
  '42501',
  'No tienes acceso a este negocio.',
  'adjusting a product of another business is rejected'
);

-- El dueño del otro negocio confirma que su producto quedó intacto; para el
-- usuario demo la RLS lo oculta por completo.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

select is(
  (select stock from public.product where id = '56000000-0000-0000-0000-000000000001'),
  7,
  'the rejected adjustment left the other business untouched'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

-- El stock ya no se puede escribir sin dejar movimiento.
select throws_ok(
  $$update public.product set stock = 999 where id = '50000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'a member cannot update the stock column directly'
);

select throws_ok(
  $$insert into public.stock_movement (business_id, product_id, type, qty_delta)
    values ('20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'ADJUST', 4)$$,
  '42501',
  null,
  'a member cannot write a movement by hand'
);

-- Las demás columnas del producto siguen siendo editables.
select results_eq(
  $$update public.product
    set price = 82000, cost = 49000, min_stock = 6
    where id = '50000000-0000-0000-0000-000000000001'
    returning price$$,
  $$values (82000::bigint)$$,
  'price, cost and min_stock remain editable'
);

select is(
  (select count(*) from public.stock_movement m
   join public.product p on p.id = m.product_id
   where p.sku in ('PER-001', 'CUI-001', 'ACC-003', 'ACC-002')),
  5::bigint,
  'the member can read the movements of their business'
);

select * from finish();
rollback;
