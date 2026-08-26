
# Plan de desarrollo — App de inventario y ganancias

Documento único de referencia. Está escrito para que un agente (Claude Code o Codex) pueda tomar **una tarea suelta** sin leer el resto del proyecto: cada tarea declara alcance, dependencias y criterios de aceptación.

## Stack

- **Frontend**: Nuxt 4 (Vue 3, Composition API, TypeScript), Tailwind CSS 4 y PrimeVue 4 (MIT); SSR desactivado en las vistas privadas (`ssr: false` por ruta o modo SPA para el panel) y despliegue en Vercel o Netlify.
- **Backend**: **Supabase** — Postgres + Auth + RLS + Storage + Edge Functions (Deno). No hay servidor propio.
- **Acceso a datos**: `@nuxtjs/supabase` (cliente tipado con `supabase gen types typescript`). Reglas de negocio en Postgres (funciones `plpgsql` y RPC), nunca duplicadas en el cliente.
- **Migraciones**: Supabase CLI (`supabase/migrations/*.sql`), versionadas en el repo. Nada de cambios a mano en el panel.
- **Referencia visual y funcional**: `Prototipo Interactivo.dc.html` (prototipo navegable) y `Mockups Inventario y Ganancias.dc.html`. Ante cualquier duda de layout, copia del prototipo.

---

## 1. Producto

Reemplazo propio de una app de gestión tipo Treinta. Genérico por diseño: sirve para perfumería, papelería o abarrotes; el catálogo no asume categorías fijas, las define el usuario.

**Objetivo**: registrar ventas rápido, saber el stock, saber cuánto se gana de verdad (venta − costo − gastos) y cobrar fiados.

**Nuevo en esta versión del plan**: cuentas de usuario reales (registro, inicio de sesión, recuperación de contraseña) y **varios negocios por cuenta**, con cambio de negocio desde la interfaz. Cada negocio tiene sus propios productos, ventas, clientes y reportes; nada se comparte entre negocios.

**No objetivos**: facturación electrónica ante la DIAN, nómina, contabilidad de partida doble, e-commerce, app nativa.

---

## 2. Reglas de negocio (fuente de verdad)

1. **Costo congelado**: cada línea de venta guarda `unit_price` y `unit_cost` copiados del producto en el instante de la venta. Cambiar el costo de un producto **nunca** modifica la ganancia histórica.
2. **Ganancia bruta** = Σ `qty × (unit_price − unit_cost)` de las líneas del periodo.
3. **Ganancia neta** = ganancia bruta − gastos con fecha dentro del periodo.
4. **Margen bruto %** = bruta / ingresos. **Margen neto %** = neta / ingresos. Las variaciones de un porcentaje se expresan en **puntos porcentuales (pp)**; las de un monto, en **%**. A nivel de producto el margen bruto es `(price − cost) / price`; con `price = 0` es indefinido (`null`), no cero. Un producto con margen bruto **por debajo del 20 %** se marca como **margen estrecho**, y también lo hace el que tiene costo pero no precio.
5. **Comparativa**: todo periodo se compara contra el periodo inmediatamente anterior de la misma longitud (hoy vs ayer, 7 d vs los 7 d previos, mes vs mes anterior).
6. **Stock**: se descuenta al confirmar la venta; se suma al recibir una orden de compra. Vender con stock 0 está permitido pero avisa.
7. **Recepción de compra**: al recibir, el `unit_cost` de la orden pasa a ser el costo actual del producto y el stock aumenta. Afecta el margen futuro, no el histórico.
8. **Stock mínimo**: `stock < min_stock` marca el producto como bajo. La sugerencia de reposición pide `max(min_stock × 2 − stock, 1)` unidades.
9. **Fiado**: una venta con método `CREDIT` genera saldo por cobrar. `deuda = Σ ventas fiado − Σ abonos`, nunca negativa. Vencido se determina por `due_date`, no por antigüedad fija (el corte de 45 días del prototipo era solo para los datos de demo).
10. **Cotización**: documento sin efecto contable. Al convertirla se crea la venta (con descuento de stock) y la cotización queda `CONVERTED`. Convertir a fiado exige cliente asignado.
11. **Montos** enteros en la moneda del negocio (COP por defecto, sin decimales). Columnas `bigint`.
12. **Zona horaria**: los cortes de periodo se calculan en la zona del negocio (`America/Bogota` por defecto). Todas las funciones de métricas reciben o resuelven esa zona; nunca cortar por UTC.
13. **Aislamiento**: ninguna consulta puede devolver datos de un negocio del que el usuario no sea miembro. Esto lo garantiza RLS, no el frontend.

---

## 3. Modelo de datos (Postgres / Supabase)

`auth.users` lo administra Supabase Auth. Todo lo demás vive en `public`. Ids `uuid default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at` mantenido por trigger.

```
profile           id (= auth.users.id), full_name, phone, avatar_url
business          id, name, nit, phone, address, currency default 'COP',
                  timezone default 'America/Bogota', logo_path, created_by
membership        id, business_id, user_id, role (OWNER|ADMIN|CASHIER),
                  unique(business_id, user_id)
category          id, business_id, name
supplier          id, business_id, name, phone, notes
product           id, business_id, name, sku, category_id, supplier_id,
                  cost bigint, price bigint, stock int, min_stock int,
                  active bool default true, unique(business_id, sku)
customer          id, business_id, name, phone, notes
sale              id, business_id, code, customer_id null, payment_method
                  (CASH|TRANSFER|CARD|CREDIT), status (CONFIRMED|VOID),
                  total bigint, discount bigint default 0, due_date date null,
                  quote_id null, sold_at timestamptz, created_by
sale_line         id, sale_id, product_id, name_snapshot, category_snapshot,
                  qty int, unit_price bigint, unit_cost bigint
payment           id, business_id, customer_id, sale_id null, amount bigint,
                  method, paid_at timestamptz          -- abonos de fiado
expense           id, business_id, concept, category, amount bigint,
                  spent_at date, recurring bool default false
purchase_order    id, business_id, code, supplier_id, status
                  (PENDING|RECEIVED|CANCELLED), expected_at date, received_at
purchase_line     id, purchase_order_id, product_id, qty int, unit_cost bigint
quote             id, business_id, code, customer_id null, valid_until date,
                  status (OPEN|CONVERTED|EXPIRED|CANCELLED), total bigint
quote_line        id, quote_id, product_id, name_snapshot, qty int,
                  unit_price bigint, unit_cost bigint
stock_movement    id, business_id, product_id, type (SALE|PURCHASE|ADJUST|RETURN),
                  qty_delta int, ref_table, ref_id, created_at
doc_sequence      business_id, doc_type (SALE|QUOTE|PURCHASE), next_value int,
                  primary key(business_id, doc_type)
```

**Índices**: `sale(business_id, sold_at)`, `sale_line(sale_id)`, `sale_line(product_id)`, `expense(business_id, spent_at)`, `payment(business_id, customer_id)`, `product(business_id, active)`, `quote(business_id, status)`, `membership(user_id)`.

**Códigos legibles** (`FAC-00001`, `COT-0031`, `OC-0142`): función `next_doc_code(p_business uuid, p_type text)` que hace `update doc_sequence ... returning` dentro de la misma transacción. Nunca exponer ids como número de factura.

### RLS

Todas las tablas con `alter table ... enable row level security`. Helper:

```sql
create or replace function public.is_member(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membership m
    where m.business_id = p_business and m.user_id = auth.uid()
  );
$$;
```

Patrón de política por tabla con `business_id`:

```sql
create policy "select own business" on product for select using (is_member(business_id));
create policy "write own business" on product for all using (is_member(business_id)) with check (is_member(business_id));
```

Casos especiales:

- `business`: `select` si `is_member(id)`; `insert` libre para usuario autenticado (el trigger crea la membresía OWNER); `update/delete` solo rol OWNER.
- `membership`: el usuario ve sus propias filas y las del negocio donde es OWNER/ADMIN; solo OWNER puede insertar o borrar miembros.
- Tablas hijas sin `business_id` (`sale_line`, `quote_line`, `purchase_line`): política vía `exists` sobre el padre.
- `profile`: solo la fila propia.

### Funciones y RPC (la lógica vive aquí)

Todas `security definer`, con validación de `is_member` al entrar, y `search_path = public`.

| Función                   | Firma                                                                                                        | Qué hace                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_business`        | `(p_name text, p_currency text, p_timezone text) → uuid`                                                  | Crea negocio, membresía OWNER, categorías base y`doc_sequence`.                                                                                            |
| `create_sale`            | `(p_business uuid, p_customer uuid, p_method text, p_discount bigint, p_due date, p_lines jsonb) → jsonb` | Transacción: resuelve precio y costo actuales, inserta venta y líneas, descuenta stock, escribe movimientos, genera código, devuelve la venta con ganancia. |
| `void_sale`              | `(p_sale uuid) → void`                                                                                    | Marca`VOID`, devuelve stock, escribe movimientos `RETURN`.                                                                                                 |
| `create_quote`           | `(p_business uuid, p_customer uuid, p_lines jsonb, p_valid_until date) → jsonb`                           | Cotización con código`COT-`.                                                                                                                               |
| `convert_quote`          | `(p_quote uuid, p_method text, p_due date) → jsonb`                                                       | Llama a`create_sale` con las líneas de la cotización y la cierra. Falla si `p_method='CREDIT'` sin cliente.                                              |
| `register_payment`       | `(p_business uuid, p_customer uuid, p_amount bigint, p_method text) → jsonb`                              | Abono; falla si excede la deuda.                                                                                                                               |
| `receive_purchase_order` | `(p_order uuid) → void`                                                                                   | Suma stock, actualiza costo del producto,`status=RECEIVED`. Idempotente.                                                                                     |
| `suggest_purchase`       | `(p_business uuid) → jsonb`                                                                               | Líneas sugeridas por stock bajo y costo estimado.                                                                                                             |
| `metrics_summary`        | `(p_business uuid, p_period text, p_month_offset int) → jsonb`                                            | Rango actual y anterior, ingresos, bruta, gastos, neta, por cobrar, y todos los porcentajes.                                                                   |
| `metrics_daily`          | `(p_business uuid, p_days int) → jsonb`                                                                   | Serie diaria de venta y ganancia.                                                                                                                              |
| `metrics_products`       | `(p_business uuid, p_period text, p_month_offset int, p_limit int) → jsonb`                               | Rentabilidad por producto**del mismo rango** que `metrics_summary`.                                                                                    |
| `metrics_categories`     | `(p_business uuid, p_period text, p_month_offset int) → jsonb`                                            | Ganancia por categoría.                                                                                                                                       |
| `metrics_alerts`         | `(p_business uuid) → jsonb`                                                                               | Stock bajo, fiados vencidos, compras sin recibir, margen bajo.                                                                                                 |
| `period_range`           | `(p_timezone text, p_period text, p_month_offset int) → record`                                           | Utilidad interna:`from`, `to`, `prev_from`, `prev_to`, etiquetas. Todo lo demás la usa.                                                               |

Vistas de lectura para listados simples: `v_credits` (deuda por cliente), `v_product_stats` (margen y valor de inventario), `v_sale_detail` (venta con ganancia y nombre de cliente).

Toda vista se declara `with (security_invoker = true)` para heredar la RLS de sus tablas, y necesita su propio `grant select ... to authenticated`: los grants iniciales se emitieron con `on all tables` y no alcanzan a los objetos creados después.

Contrato de `v_product_stats` (una fila por producto del negocio):

```
id, business_id, name, sku, active,
category_id, category_name, supplier_id, supplier_name,
cost, price, stock, min_stock,
margin_amount   bigint   -- price - cost
margin_pct      numeric  -- margen bruto %, dos decimales, null si price = 0
inventory_value bigint   -- cost * stock
retail_value    bigint   -- price * stock
is_low_stock    boolean  -- stock < min_stock
is_thin_margin  boolean  -- margen bruto < 20 %
created_at, updated_at
```

Los filtros del inventario no son parámetros de la vista, se aplican desde el cliente vía PostgREST: `q` con `or=(name.ilike.*q*,sku.ilike.*q*)`, categoría y proveedor con `eq`, y `low` / `thin_margin` con `is_low_stock=eq.true` / `is_thin_margin=eq.true`.

Ejemplo del contrato de `metrics_summary`:

```json
{
  "range": {"from":"2026-06-01","to":"2026-07-01","label":"junio 2026","previous_label":"mayo 2026"},
  "revenue": 30900000, "gross_profit": 11482300, "expenses": 2286000, "net_profit": 9196300,
  "receivable": 2310000, "sales_count": 412, "debtors_count": 5,
  "pct": {"revenue_change": -14.2, "gross_margin": 44.4, "gross_margin_pp": 4.7,
          "expense_ratio": 20.2, "expense_ratio_pp": 2.3, "net_margin": 24.2, "net_profit_change": -4.7}
}
```

### Storage

- Bucket privado `logos` (`{business_id}/logo.png`), política de lectura y escritura por `is_member`.
- Bucket privado `documents` para PDF generados si se opta por Edge Function; URLs firmadas de 10 minutos.

### Edge Functions (solo lo que no puede vivir en SQL)

- `document-pdf` — recibe `{type: 'sale'|'quote', id}`, valida sesión, arma el HTML de la plantilla y devuelve el PDF con la tipografía embebida.
- `import-products` — CSV grande: valida por fila, hace upsert por SKU y devuelve `{created, updated, errors[]}`.
- `whatsapp-share` (opcional, fase posterior) — genera PNG y URL firmada.

---

## 4. Autenticación y sesión

- **Registro** con email + contraseña (Supabase Auth) y confirmación por correo. Opcional Google OAuth (una casilla en el panel de Supabase, un botón en la UI).
- Trigger `on auth.users insert` → crea `profile`.
- **Onboarding**: si el usuario no tiene ninguna membresía, la app lo lleva a "Crear negocio" (nombre, moneda, zona horaria) que llama a `create_business`.
- **Negocio activo**: guardado en cookie/`localStorage` y en un store de Pinia; toda consulta lo pasa como `p_business` o filtra por `business_id`. El middleware de Nuxt redirige a onboarding si no hay negocio activo válido.
- **Cambio de negocio**: selector en el pie de la sidebar con la lista de membresías + "Crear otro negocio". Al cambiar se limpian los caches de datos.
- **Recuperación de contraseña**: enlace por correo → pantalla de nueva contraseña.
- **Invitaciones** (fase posterior): OWNER invita por email, se crea `membership` con rol; hasta entonces el rol único real es OWNER.
- **Rutas**: `/login`, `/registro`, `/recuperar`, `/nueva-contrasena`, `/onboarding` públicas; todo lo demás detrás de middleware `auth`.

---

## 5. Pantallas

Ocho vistas privadas + las de autenticación. Navegación lateral. En escritorio, sidebar fija de 198 px con el selector de negocio abajo; en móvil (`< 760 px`) la sidebar es un cajón deslizable que se abre con el botón de hamburguesa y se cierra al elegir sección o tocar el fondo. Rango 760–1120 px: sidebar de 170 px, KPIs en 3 columnas, paneles apilados.

| Vista                  | Contenido                                                                                                                                                                                           | Acciones                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resumen**      | 5 KPIs (ventas, bruta, gastos, neta destacada en oscuro, por cobrar) cada uno con su porcentaje; gráfica de 14 días; rentabilidad por producto del periodo; últimas ventas; "Requiere atención" | Selector de periodo (Hoy / 7 d / Mes) + flechas ‹ › y selector de los últimos 18 meses; clic en una venta abre su factura; cada alerta navega a su sección |
| **Caja**         | Buscador de producto, botones de frecuentes, carrito con margen por línea, panel de cliente/pago/total                                                                                             | Cobrar (efectivo, transferencia, tarjeta, fiado), guardar cotización, vaciar. Fiado sin cliente → error                                                      |
| **Cotizaciones** | Lista con código, detalle, cliente y total                                                                                                                                                         | Cobrar, pasar a fiado, ver/exportar PDF o imagen, eliminar                                                                                                     |
| **Inventario**   | Tabla con costo, precio, margen, stock/mínimo y valor; buscador; filtros Todos / Stock bajo / Margen bajo                                                                                          | Alta de producto, importar CSV, clic en fila abre panel lateral para editar costo, precio, stock y mínimo                                                     |
| **Fiados**       | Tarjetas de por cobrar / clientes con deuda / abonado en el mes + lista de deudores                                                                                                                 | Abonar, con botón**Abonar todo** que precarga la deuda exacta                                                                                           |
| **Gastos**       | Total del mes, distribución por categoría, lista                                                                                                                                                  | Nuevo gasto                                                                                                                                                    |
| **Compras**      | Sugerencia de reposición + órdenes con estado                                                                                                                                                     | Crear orden sugerida, recibir orden                                                                                                                            |
| **Reportes**     | Cuatro cifras del periodo con su % sobre ingresos, ganancia por categoría, mejor y peor producto, historial                                                                                        | Mismo selector de periodo; clic en fila abre la factura; exportar CSV                                                                                          |
| **Ajustes**      | Datos del negocio (nombre, NIT, teléfono, moneda, zona horaria, logo), cuenta del usuario, lista de negocios                                                                                       | Editar negocio, crear negocio, cerrar sesión                                                                                                                  |

**En móvil no hay tablas**: inventario, fiados, gastos, compras, cotizaciones e historial se muestran como tarjetas (título + monto arriba, contexto debajo, datos secundarios como etiquetas). Botones de acción de ancho completo, alto mínimo 44 px.

---

## 6. Sistema visual

- Tipografía: **Space Grotesk** (títulos, cifras) y **IBM Plex Sans** (texto). **IBM Plex Mono** para montos en tablas, SKU y horas.
- Color: fondo papel `#fbfaf6`, paneles `#fff`, superficie secundaria `#f3f0e9`, tinta `#191817`, texto suave `#6b6864` / `#8c8880`, líneas `rgba(25,24,23,.10)`.
- Acento `#1f5aff` (acciones), positivo `#0f7b6c`, negativo `#c2410c`. La cifra principal del periodo va sobre bloque oscuro `#191817`.
- Radio 6–8 px en controles, 8–10 px en tarjetas. Densidad alta: cuerpo 12,5 px, etiquetas 9,5 px en mayúsculas con `letter-spacing`.
- Verde para mejora, terracota para deterioro. En gastos la lógica se invierte (bajar es bueno).
- **UI y estilos**: Tailwind CSS 4 para layout, responsive y utilidades; PrimeVue 4 (MIT) para componentes accesibles, con un preset propio que aplica estos tokens. Sí utilidades adicionales (date-fns, zod, unplugin-icons).

---

## 7. Estructura del repo

```
supabase/
  migrations/          0001_init.sql, 0002_rls.sql, 0003_functions.sql, ...
  functions/           document-pdf/, import-products/
  seed.sql             negocio demo con 8 productos, 5 clientes, 2 proveedores
app/  (proyecto Nuxt)
  nuxt.config.ts
  app/                  directorio fuente de Nuxt 4
    composables/        useBusiness, useMetrics, useCart, useMoney, usePeriod
    stores/             auth.ts, business.ts, cart.ts
    layouts/            default.vue (sidebar + cajón móvil), auth.vue
    middleware/         auth.global.ts, business.ts
    pages/              index(resumen), caja, cotizaciones, inventario,
                        fiados, gastos, compras, reportes, ajustes,
                        login, registro, recuperar, onboarding
    components/         ui/ (Button, Chip, Segmented, Modal, Drawer, Toast, DataTable, CardList),
                        kpi/, caja/, documento/
    types/database.ts   generado por supabase gen types
```

Regla: cada lista larga se implementa **una vez** como `DataTable` (escritorio) + `CardList` (móvil) y las vistas solo declaran columnas y plantilla de tarjeta.

---

## 8. Backlog de tareas

Formato: `ID · título — entregable — criterio de aceptación`. `dep:` = dependencias. `S` = Supabase/SQL, `F` = frontend, `X` = transversal.

### Fase 0 — Cimientos

- **S0.1 · Proyecto Supabase + CLI** — `supabase init`, entorno local con Docker, script de reset, `.env.example` con `NUXT_PUBLIC_SUPABASE_URL` y `NUXT_PUBLIC_SUPABASE_KEY`. *Aceptación*: `supabase db reset` corre en limpio y documentado en el README.
- **S0.2 · Migración inicial** — todas las tablas de §3 con tipos, constraints e índices, más triggers de `updated_at`. dep: S0.1. *Aceptación*: reset desde cero sin errores; `seed.sql` carga el negocio demo.
- **S0.3 · RLS y helper `is_member`** — políticas de §3 en todas las tablas, incluidas las hijas por `exists`. dep: S0.2. *Aceptación*: test SQL (pgTAP o script) que con el JWT del usuario A no devuelve ni una fila del negocio de B, en cada tabla.
- **S0.4 · `create_business` + trigger de `profile` + `doc_sequence`** — alta de negocio con membresía OWNER, categorías base y secuencias. dep: S0.3. *Aceptación*: llamar a la RPC como usuario nuevo deja el negocio visible solo para él; `next_doc_code` no repite códigos con 100 llamadas concurrentes.
- **F0.1 · Esqueleto Nuxt** — Nuxt 4 + TS + Tailwind CSS 4 + PrimeVue 4 (MIT) + `@nuxtjs/supabase` + Pinia, layouts `default` y `auth`, tokens de §6, tipografías autohospedadas, componentes base `ui/`. *Aceptación*: las 9 rutas privadas existen con placeholder; el cajón móvil abre y cierra por debajo de 760 px; sin errores de hidratación.
- **F0.2 · Cliente tipado** — `supabase gen types typescript` en un script npm, wrapper de errores que convierte fallos de RPC en toasts legibles. dep: S0.2, F0.1.

### Fase 1 — Cuentas y negocios

- **F1.1 · Registro, login y recuperación** — páginas `/registro`, `/login`, `/recuperar`, `/nueva-contrasena` con validación (zod), estados de carga y errores del proveedor traducidos. dep: F0.1. *Aceptación*: registro → correo de confirmación → login → sesión persistente tras recargar.
- **F1.2 · Middleware de sesión y negocio** — `auth.global.ts` redirige a `/login`; `business.ts` redirige a `/onboarding` si no hay membresías y valida que el negocio activo pertenezca al usuario. dep: F1.1, S0.4. *Aceptación*: manipular el negocio activo en `localStorage` por uno ajeno no filtra datos (RLS responde vacío) y la app vuelve a onboarding.
- **F1.3 · Onboarding "Crear negocio"** — formulario nombre, moneda, zona horaria → `create_business` → entra al Resumen. dep: F1.2.
- **F1.4 · Selector de negocio** — control al pie de la sidebar: lista de membresías, negocio activo marcado, "Crear otro negocio", cerrar sesión. Al cambiar limpia caches y vuelve al Resumen. dep: F1.3. *Aceptación*: con dos negocios, las cifras del Resumen cambian por completo al alternar y no queda dato del anterior en pantalla.
- **F1.5 · Ajustes** — datos del negocio (con subida de logo a Storage), datos de la cuenta, cambio de contraseña. dep: F1.4.

### Fase 2 — Catálogo e inventario

- **S2.1 · Consultas de producto** — vista `v_product_stats` (margen, valor de inventario, bandera de stock bajo) y filtros por `q`, categoría, proveedor, `low`, `thin_margin`. dep: S0.3.
- **S2.2 · Ajuste de stock** — RPC `adjust_stock(p_product, p_delta, p_reason)` con movimiento. dep: S2.1.
- **S2.3 · Import CSV** — Edge Function `import-products` con upsert por SKU y reporte de errores por fila. dep: S2.1.
- **F2.1 · Vista Inventario** — tabla en escritorio, tarjetas en móvil, buscador y filtros, panel lateral de edición (costo, precio, stock, mínimo) con margen y valor en vivo. dep: S2.1, F0.2. *Aceptación*: la fila con stock bajo se destaca con su aviso; el panel guarda y refresca sin recargar la página.
- **F2.2 · Alta de producto e import** — modal de alta y flujo de CSV con resumen del resultado. dep: S2.3, F2.1.

### Fase 3 — Caja y ventas

- **S3.1 · `create_sale`** — la RPC completa de §3. dep: S0.4. *Aceptación*: test que cambia el costo del producto después de vender y comprueba que la ganancia de la venta no cambia; `CREDIT` sin cliente falla con mensaje claro; dos llamadas concurrentes no dejan stock inconsistente.
- **S3.2 · `void_sale` y listados de venta** — anulación con devolución de stock y `v_sale_detail`. dep: S3.1.
- **S3.3 · Búsqueda de caja y frecuentes** — RPC/vistas `search_products(q)` (máx 8) y `frequent_products(limit)` por ventas de 30 días. dep: S2.1.
- **F3.1 · Vista Caja** — buscador con resultados (stock y precio), frecuentes, carrito con ± y margen por línea, panel de cliente, método de pago, total y ganancia estimada. dep: S3.1, S3.3. *Aceptación*: cobrar limpia el carrito, muestra confirmación con el monto y el stock baja; fiado sin cliente muestra el error del backend; el botón "+ Nueva venta" no aparece dentro de Caja.
- **F3.2 · Caja en móvil** — panel de pago apilado bajo el carrito, botón de cobro de ancho completo, controles de 44 px. dep: F3.1.

### Fase 4 — Dinero

- **S4.1 · Gastos** — CRUD con filtros de rango y categoría; agregado por categoría para la vista. dep: S0.3.
- **S4.2 · Fiados** — vista `v_credits`, RPC `register_payment`, cálculo de vencidos por `due_date`. dep: S3.1. *Aceptación*: abono mayor a la deuda falla; la deuda nunca queda negativa; el vencido se calcula en la zona del negocio.
- **F4.1 · Vista Gastos** — totales, distribución por categoría, lista y modal de alta. dep: S4.1.
- **F4.2 · Vista Fiados** — tarjetas de resumen, lista de deudores, modal de abono con **Abonar todo** que precarga la deuda exacta. dep: S4.2. *Aceptación*: tras abonar todo, el cliente sale de la lista y el total por cobrar baja el mismo monto.

### Fase 5 — Compras

- **S5.1 · Órdenes de compra** — CRUD y `receive_purchase_order` idempotente. dep: S2.2. *Aceptación*: recibir dos veces la misma orden no duplica stock.
- **S5.2 · `suggest_purchase`** — cálculo de §2.8 con costo estimado. dep: S2.1.
- **F5.1 · Vista Compras** — banner de sugerencia con creación en un clic, tabla/tarjetas de órdenes con acción Recibir. dep: S5.1, S5.2.

### Fase 6 — Cotizaciones

- **S6.1 · `create_quote` y listados** — con código `COT-` y `valid_until`. dep: S3.1.
- **S6.2 · `convert_quote`** — a venta o a fiado, cierre de la cotización, validación de cliente. dep: S6.1. *Aceptación*: convertir descuenta stock una sola vez y deja la cotización `CONVERTED`; con `CREDIT` sin cliente falla.
- **F6.1 · Vista Cotizaciones + guardar desde Caja** — botón en Caja, lista con Cobrar / A fiado / Ver-PDF / Eliminar, "A fiado" atenuado sin cliente. dep: S6.2, F3.1.

### Fase 7 — Métricas

- **S7.1 · `period_range`** — utilidad de rangos con zona horaria del negocio. dep: S0.2. *Aceptación*: tests de borde (cambio de mes, meses de 28 y 31 días, `month_offset` grande, cambio de año).
- **S7.2 · `metrics_summary`** con todos los porcentajes de §3. dep: S7.1, S3.1, S4.1. *Aceptación*: `gross_margin`, `expense_ratio` y `net_margin` coherentes entre sí; comparativa contra el rango anterior correcta.
- **S7.3 · `metrics_daily`, `metrics_products`, `metrics_categories`, `metrics_alerts`** — dep: S7.2. *Aceptación*: `metrics_products` usa **el mismo rango** que `metrics_summary` (fallo detectado en el prototipo).
- **F7.1 · Vista Resumen** — KPIs con porcentaje y color, gráfica de 14 días, rentabilidad por producto con el periodo en el título, últimas ventas, alertas navegables. dep: S7.2, S7.3.
- **F7.2 · Selector de periodo** — segmentado Hoy/7 d/Mes + flechas ‹ › + selector de 18 meses; en móvil ocupa el ancho completo con etiquetas cortas y la flecha adelante se desactiva en el mes actual. dep: F7.1.
- **F7.3 · Vista Reportes** — cifras con % sobre ingresos, ganancia por categoría, mejor y peor producto, historial clicable y exportación CSV. dep: S7.3.

### Fase 8 — Documentos

- **S8.1 · Edge Function `document-pdf`** — plantilla única para factura y cotización (encabezado del negocio con logo, cliente, líneas, total, nota), tipografías embebidas, valida sesión y membresía. dep: S3.2, S6.1. *Aceptación*: el PDF abre en móvil y escritorio, pesa < 300 kB y respeta la tipografía.
- **F8.1 · Visor de documento** — overlay con el documento, Descargar PDF (Edge Function) y Descargar imagen (canvas en cliente); en cotizaciones, Convertir en venta / Convertir en fiado. Se cierra al cambiar de sección. dep: S8.1, F6.1.

### Fase 9 — Cierre

- **X9.1 · Estados vacíos y errores** — cada lista con su mensaje de vacío; toasts para errores de RPC; pantalla de sesión expirada.
- **X9.2 · Pruebas E2E** — Playwright contra Supabase local: registro → crear negocio → venta completa → cotización a fiado → abono total → recibir compra → navegar a un mes anterior; y un test de aislamiento entre dos negocios del mismo usuario.
- **X9.3 · Despliegue** — proyecto Supabase de producción, migraciones por CI (`supabase db push`), Nuxt en Vercel con variables de entorno, backups diarios activados.
- **X9.4 · Observabilidad** — logs de Edge Functions revisables, Sentry (o similar) en el frontend, y una consulta guardada de errores de RPC.

---

## 9. Convenciones para los agentes

- **Una tarea, un PR.** Título `[ID] título`. No mezclar tareas de fases distintas.
- **La regla de negocio vive en Postgres.** Si una tarea de UI necesita un cálculo de dinero que no existe, se crea la función SQL en esa misma tarea (o se declara la dependencia), nunca se calcula en el cliente. Excepción única: el estimado del carrito antes de cobrar.
- **Toda migración es aditiva y versionada.** Nada de editar migraciones ya aplicadas; se agrega una nueva.
- **RLS primero.** Ninguna tabla nueva se mergea sin políticas y sin su test de aislamiento.
- **Contrato inmutable**: los nombres de campos de §3 y de los JSON de métricas son la interfaz. Cambiarlos exige actualizar este documento en el mismo PR.
- **Tests obligatorios**: toda regla de §2 que se toque necesita prueba. Dinero y periodos no se dan por buenos sin test.
- **Formato de moneda** en el cliente con `Intl.NumberFormat` según `business.currency`; el prototipo usa COP sin decimales.
- **Accesibilidad mínima**: foco visible, área táctil de 44 px, contraste AA en texto sobre color.
- **Nada de claves de servicio en el frontend**: solo `anon key`. La `service_role` vive únicamente en Edge Functions y CI.

## 10. Decisiones pendientes

1. ¿Empleados con acceso (rol CASHIER) en el corto plazo? El esquema ya lo soporta; falta decidir invitaciones y qué puede ver un cajero.
2. Impuestos: el plan asume precios con impuesto incluido y sin desglose. Confirmar si hace falta IVA por línea.
3. ¿Modo sin conexión para la caja (PWA con cola local)? Cambia el diseño de `create_sale` a idempotente por `client_uuid`.
4. ¿Facturación electrónica más adelante? Requeriría campos fiscales en `sale` y un proveedor de firma.
5. ¿Los negocios de una misma cuenta comparten catálogo de productos o son totalmente independientes? El plan asume independientes.
