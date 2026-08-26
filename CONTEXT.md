# Contexto de trabajo — Cashi

Actualizado: 26 de agosto de 2026, después de completar S3.2. La Fase 2 está terminada y la Fase 3 va por su tercera tarea.

## Preferencias del usuario

- Ejecutar comandos y tareas técnicas sin pedir confirmación.
- Preguntar antes de tomar decisiones de negocio o de diseño.
- El producto debe ser genérico; ejemplos de negocios indicados por el usuario: perfumería y tienda de ropa.
- Usar Nuxt 4, Tailwind CSS y PrimeVue.
- Se decidió expresamente usar PrimeVue 4 bajo MIT. No subir a PrimeVue 5 sin revisar nuevamente su licencia con el usuario.

## Estado actual

Completado y versionado:

| Tarea | Commit | Resultado |
| --- | --- | --- |
| S0.1 | `c6ce5ee` | Proyecto Supabase local y CLI |
| S0.2 | `a3e45de` | Esquema inicial y seed demo |
| S0.3 | `9797d7c` | RLS y pruebas de aislamiento |
| S0.4 | `a92ade7` | `create_business`, trigger de perfil y secuencias |
| F0.1 | `2217c0b` | Esqueleto Nuxt 4, Tailwind y PrimeVue |
| F0.2 | `4d364a8` | Tipos Supabase y errores traducidos a Toast |
| Decisión UI | `5292194` | Migración a PrimeVue 4 MIT |
| F1.1 | `ef6a1cd` | Registro, login y recuperación de contraseña |
| F1.2 | `66b2ec2` | Middleware de sesión y validación del negocio activo |
| F1.3 | `76b673e` | Onboarding real para crear y activar un negocio |
| F1.4 | `d17e319` | Selector de negocio, cambio de contexto y cierre de sesión |
| F1.5 | `70741ab` | Ajustes de negocio, logo privado, cuenta y contraseña |
| S2.1 | `62d45c7` | Vista `v_product_stats`, filtros de inventario e índices |
| S2.2 | `64736d2` | RPC `adjust_stock` y cierre de escritura directa del stock |
| F2.1 | `0eebe56` | Vista Inventario con filtros y panel de edición |
| — | `f8d56f0` | Recuperación del negocio propio ante un id guardado inválido |
| — | `3b0cf81` | Responsive del Inventario entre 760 y 1120 px |
| S2.3 | `673eb1e` | Edge Function `import-products` y RPC `import_products` |
| F2.2 | `e401a70` | Alta de producto e importación CSV desde el Inventario |
| S3.1 | `f9e7a02` | RPC `create_sale` con costo congelado y orden de bloqueo |
| S3.2 | `9c782bd` | RPC `void_sale` idempotente y vista `v_sale_detail` |

La siguiente tarea del `PLAN.md` es **S3.3 · Búsqueda de caja y frecuentes**, la última pieza de backend antes de F3.1 (vista Caja). También están libres S4.1 (gastos) y S7.1 (`period_range`).

## Stack instalado

- Nuxt `4.5.2`, Vue `3.5.41`, TypeScript `5.9.3`.
- Tailwind CSS `4.3.3`.
- PrimeVue y módulo Nuxt `4.5.5`, licencia MIT.
- Supabase Nuxt `2.0.10`, Pinia `4.0.3`, Zod `4.4.3`.
- Base de datos, Auth, Mailpit y Studio ejecutados por Supabase CLI local.
- El proyecto de Nuxt está en `app/`; el directorio fuente de Nuxt 4 es `app/app/`.

## Entorno local

- No hay un proyecto Supabase remoto enlazado ni una cuenta remota seleccionada. Todo está conectado al Supabase local.
- `.env` existe en la raíz, está ignorado por Git y contiene la URL y publishable key locales. No copiar claves a archivos versionados.
- Aplicación: `http://localhost:3000`. En esta máquina Nuxt suele enlazar `localhost` a IPv6, por lo que conviene usar este hostname y no `127.0.0.1` para abrir la app.
- Supabase API: `http://127.0.0.1:54321`.
- Supabase Studio: `http://127.0.0.1:54323`.
- Mailpit: `http://127.0.0.1:54324`.
- `supabase/config.toml` exige confirmación por correo y permite callbacks locales para registro y recuperación.

Comandos principales:

```powershell
npm run supabase:start
npm run app:dev
npm run app:typecheck
npm run app:build
npm --prefix app run smoke
npm run app:test:auth
npm run app:test:business-switcher
npm run app:test:inventory
npm run app:test:inventory-import
npm run app:test:onboarding
npm run app:test:settings
npm run app:test:session-business
npm run db:test
npm run db:test:sales
npm run db:test:functions
npm run db:types
```

## Implementación relevante

- `app/app/types/database.ts` se genera con `npm run db:types`.
- `app/app/composables/useSupabaseRequest.ts` acepta resultados tipados de consultas, RPC y Auth; traduce errores y muestra PrimeVue Toast.
- `app/app/utils/errors.ts` contiene las traducciones seguras de errores de Supabase/Postgres.
- `app/app/components/AuthField.vue` y `AuthHeader.vue` son las piezas compartidas de autenticación.
- `/registro` guarda `full_name` en metadata; el trigger SQL crea `public.profile`.
- `/login` usa email y contraseña y redirige al resumen.
- `/recuperar` envía el correo hacia `/nueva-contrasena`.
- `/nueva-contrasena` valida la sesión de recuperación, actualiza la contraseña, cierra esa sesión y devuelve al login.
- Los formularios usan Zod, mensajes por campo, estados de carga y errores del proveedor traducidos.
- `app/tests/auth-flow.mjs` ejecuta registro → correo Mailpit → confirmación → login → recarga persistente → recuperación → nueva contraseña → nuevo login. Crea usuarios de prueba únicos solo en Supabase local.
- `app/app/middleware/auth.global.ts` protege las rutas privadas y conserva el destino solicitado en `?redirect=`.
- `app/app/middleware/business.ts` carga las membresías y envía a onboarding cuando no existe un negocio válido.
- `app/app/stores/business.ts` conserva `cashi.active-business-id` en `localStorage`, valida el UUID mediante una consulta protegida por RLS y expone el negocio/membresía activos. **La sesión no vive en `localStorage`**: está en la cookie `sb-*-auth-token` que gestiona `@nuxtjs/supabase`.
- Si el id guardado ya no sirve (negocio borrado o UUID ajeno) el store activa la primera membresía y el usuario sigue trabajando; solo llega a onboarding quien no tiene ningún negocio. El id ajeno nunca se activa, así que RLS sigue sin devolver datos de otro.
- Ojo con `npm run db:reset`: borra todo lo que no esté en el seed. Si había un negocio creado desde la interfaz, la pestaña abierta queda apuntando a un UUID inexistente.
- `app/app/components/BusinessSwitcher.vue` lista todas las membresías, marca el negocio activo y funciona tanto en la sidebar de escritorio como en el encabezado móvil.
- Al alternar negocios se actualiza `cashi.active-business-id`, se limpian los caches de Nuxt y se vuelve al Resumen. Las vistas provisionales ya muestran el negocio real en vez de un nombre fijo.
- El selector contiene "Crear otro negocio" y "Cerrar sesión"; al salir se eliminan la sesión de Supabase, el estado Pinia y el negocio guardado.
- `/ajustes` permite al propietario editar nombre, NIT, teléfono, dirección, moneda y zona horaria del negocio activo. Otros roles ven esos controles deshabilitados según la política RLS existente.
- Los datos personales (`full_name`, teléfono) se guardan en `profile` y en metadata de Auth; el correo se muestra como dato de acceso de solo lectura.
- El cambio de contraseña usa la sesión autenticada de Supabase y exige al menos 8 caracteres con confirmación coincidente.
- El bucket privado `logos` admite únicamente `{business_id}/logo.png`, PNG de hasta 2 MiB. Sus políticas de lectura y escritura validan la membresía; la UI descarga el archivo autenticado y usa una URL local, nunca una URL pública.
- Las opciones de moneda y zona horaria viven en `app/app/utils/business-options.ts` y se comparten entre onboarding y Ajustes.
- `/onboarding` valida nombre, moneda y zona horaria; llama a `create_business`, recarga las membresías, activa el UUID devuelto y entra al Resumen.
- El formulario ofrece `COP` y `America/Bogota` como valores iniciales, además de opciones comunes como `DOP` y `America/Santo_Domingo`.
- `app/tests/onboarding-flow.mjs` registra y confirma un usuario nuevo, crea el negocio desde la UI y verifica directamente que existan la membresía `OWNER`, las dos categorías base y las tres secuencias documentales.
- `app/tests/business-switcher.mjs` crea temporalmente un segundo negocio, alterna ambos desde escritorio y móvil, comprueba el contexto visible y el cierre de sesión, y elimina el fixture al finalizar.
- `app/tests/settings-flow.mjs` registra un usuario temporal, crea y edita su negocio, sube un PNG real, actualiza el perfil y la contraseña, vuelve a iniciar sesión y elimina todos sus fixtures.
- `v_product_stats` (migración `20260826150000_product_stats.sql`) devuelve cada producto con `margin_amount`, `margin_pct`, `inventory_value`, `retail_value`, `is_low_stock` e `is_thin_margin`, más el nombre de su categoría y proveedor.
- La vista se declara `with (security_invoker = true)`; sin esa opción correría como su dueño y expondría el catálogo de todos los negocios. Los `grant` iniciales usaron `on all tables`, así que la vista necesita su propio `grant select ... to authenticated`. Ambas cosas están cubiertas por pruebas.
- Reglas aplicadas: stock bajo es `stock < min_stock` estricto (4/4 no es bajo); el margen es `(price − cost) / price` con dos decimales y `null` cuando `price = 0`; margen estrecho es margen bruto por debajo del **20 %**, y también un producto con costo pero sin precio.
- Los filtros del inventario se aplican desde el cliente con PostgREST: `or=(name.ilike.*q*,sku.ilike.*q*)` para la búsqueda, `eq` para categoría y proveedor, `is_low_stock=eq.true` e `is_thin_margin=eq.true` para las banderas. Hay índices `product(business_id, category_id)` y `product(business_id, supplier_id)`.
- El seed incluye `ACC-004 · Bolsa de regalo` (16 % de margen) para que el filtro de margen bajo tenga datos reales.
- No se añadió índice trigram: con el catálogo acotado por `business_id` el `ilike` es barato. Reevaluar en S3.3 si la búsqueda de caja lo necesita.
- `adjust_stock(p_product, p_delta, p_reason)` (migración `20260826160000_adjust_stock.sql`) corrige existencias y escribe el movimiento `ADJUST` en la misma transacción. Devuelve `jsonb` con `product_id`, `previous_stock`, `stock`, `qty_delta`, `reason` y `movement_id`.
- La suma se resuelve dentro del `update` (`stock = stock + p_delta`), no con una lectura previa, para que dos ajustes simultáneos no se pisen.
- El motivo es **obligatorio**: sin él el histórico de movimientos no sirve para auditar. La UI de F2.1 debería ofrecer motivos rápidos (conteo físico, merma, devolución, corrección).
- El stock resultante puede quedar negativo, coherente con que la app tolera vender sin existencias.
- Se cerró la puerta de atrás: `authenticated` ya no puede hacer `update` de `product.stock` (conserva `name`, `sku`, `category_id`, `supplier_id`, `cost`, `price`, `min_stock`, `active`) ni escribir en `stock_movement`. Al intentarlo PostgREST responde `403 / 42501`. Si una tarea futura necesita mover stock, va por una función `security definer`, nunca por un update.
- `stock_movement` ganó la columna `reason`, nula en los movimientos que generen ventas y compras.
- Los mensajes de error de las RPC llegan al usuario tal cual mediante `toUserMessage` de `app/app/utils/errors.ts`, salvo `42501`, que se reemplaza por el texto genérico de permisos.
- `/inventario` lista `v_product_stats` con `UiDataTable` en escritorio y `UiCardList` en móvil; el buscador rebota 250 ms y los filtros de categoría, proveedor, stock bajo y margen bajo se combinan en la misma consulta.
- `app/app/utils/inventory.ts` centraliza el contrato de la vista: las columnas del `select`, la normalización de las columnas opcionales a `ProductRow`, el saneado del término de búsqueda y el estimado de margen del panel.
- El `select` de PostgREST estrecha el tipo de la fila, así que el tipo de entrada de `toProductRow` es un `Pick` de la vista y no la vista completa; con la fila entera no compila.
- El término de búsqueda se limpia de `,()"\` porque romperían la gramática del filtro `or` de PostgREST.
- `InventoryProductPanel` edita costo, precio y mínimo con un `update`, y las existencias **solo** con `adjust_stock` y un motivo (cuatro presets más texto libre). El margen y el valor se recalculan en vivo como estimado antes de guardar; el dato de verdad lo devuelve la vista al refrescar.
- `app/app/composables/useMoney.ts` formatea montos y porcentajes con `Intl.NumberFormat` según la moneda del negocio activo, sin decimales, y muestra `—` cuando el margen es indefinido.
- `ui/Drawer.vue` acepta `position`, `panelClass` y `header`; con `header` deja de usarse el modo sin relleno de la navegación móvil. El inventario lo abre a la derecha.
- `supabase/functions/import-products/` es la primera Edge Function del proyecto. El contenedor `supabase_edge_runtime_cashi` que levanta `supabase start` ya la sirve en `http://127.0.0.1:54321/functions/v1/import-products`; **no hace falta `supabase functions serve`** aparte, y el runtime recarga en caliente al editar el archivo (si una prueba falla justo tras editar, puede estar usando el worker anterior: repítela).
- La función corre con la sesión de quien llama (cabecera `Authorization` reenviada al cliente), no con la `service_role`, así que la RLS del negocio sigue aplicando.
- `supabase/functions/_shared/csv.ts` es lógica pura sin APIs de Deno: parser RFC 4180 con comillas escapadas, detección de separador (coma, punto y coma o tabulador), alias de encabezados en español e inglés y `parseAmount`, que acepta `12.000` pero rechaza decimales en vez de redondearlos.
- La escritura no está en la función sino en la RPC `import_products(p_business, p_rows jsonb)`: una sola transacción que resuelve categorías y proveedores por nombre, los crea si faltan y hace match de SKU sin distinguir mayúsculas.
- **Por qué la RPC y no un upsert desde la función**: tras S2.2 el rol `authenticated` no tiene `update` sobre todas las columnas de `product`, y el upsert masivo de PostgREST incluye `business_id` en el `SET`, así que respondía `permission denied for table product`.
- El stock solo se fija al crear un producto. Si el CSV trae existencias para un SKU que ya existe se ignoran y se cuentan en `stock_ignored`, porque cambiarlas exige `adjust_stock`.
- `InventoryProductFormModal` da de alta un producto con un `insert` directo. Si el SKU se repite, el error `23505` se muestra en el campo («Ya existe un producto con este SKU.») en vez de como toast genérico.
- Categoría y proveedor del alta son `PrimeSelect` **editables**: se puede elegir uno existente o escribir uno nuevo, que se crea al guardar. Se hizo así porque no hay ninguna otra pantalla para crear categorías, y un negocio nuevo solo trae `Perfumería` y `Tienda de ropa` de `create_business`.
- `InventoryImportModal` llama a la función con `client.functions.invoke`. Cuando la función responde con error hay que leer `error.context.json()`: el mensaje del `FunctionsHttpError` por sí solo no dice nada útil.
- El resumen del import muestra creados, actualizados, filas con error (fila, SKU y motivo) y un aviso cuando se ignoraron existencias. La plantilla descargable lleva BOM para que Excel no rompa los acentos.
- `create_sale(p_business, p_customer, p_method, p_discount, p_due, p_lines)` recibe `p_lines` como `[{product_id, qty}]`. **El precio y el costo los resuelve el servidor**, nunca vienen del cliente, y quedan congelados en `sale_line` junto al nombre y la categoría del momento.
- El stock se descuenta recorriendo los productos **ordenados por id**. Ese orden es lo único que evita interbloqueos: se comprobó que sin él 33 de 40 transacciones simultáneas mueren con `40P01`, y con él ninguna. Si alguna RPC futura toca varios productos, debe hacerlo en el mismo orden.
- Las líneas repetidas del mismo producto se suman en una sola: un carrito no tiene dos renglones del mismo artículo.
- Vender sin existencias está permitido y puede dejar el stock negativo; avisar es tarea de la interfaz.
- `p_due` solo se guarda en las ventas `CREDIT`; en las demás se descarta.
- **El descuento resta de la ganancia bruta** (decisión tomada en S3.1, ya reflejada en la regla 2 del `PLAN.md`). Las métricas de la Fase 7 tienen que restarlo igual o las cifras no cuadrarán.
- Las pruebas que cuentan movimientos o ventas se acotan a sus propios fixtures: contar totales del negocio demo las vuelve frágiles ante cualquier ajuste hecho a mano en la base local.
- `void_sale(p_sale)` bloquea la fila de la venta con `for update` **antes** de leer su estado. Sin eso, dos anulaciones simultáneas leerían `CONFIRMED` las dos y devolverían el stock por duplicado; la prueba de concurrencia dispara diez a la vez.
- `v_sale_detail` **incluye las ventas anuladas** a propósito, para que el historial pueda mostrarlas. Cualquier cálculo de dinero debe filtrar `status = 'CONFIRMED'`; las métricas de la Fase 7 tienen que hacerlo.
- `gross_profit` de la vista ya trae el descuento restado, igual que `create_sale`.
- Cuidado con `sum()` en las vistas: devuelve `numeric` y los montos del proyecto son `bigint`. Hay que castear en la definición o los tipos generados y las pruebas no cuadran.
- El seed local incluye `onboarding@cashi.local` sin negocio y `other@cashi.local` con un tenant ajeno para las pruebas automatizadas. Las credenciales están documentadas junto a esos fixtures en `supabase/seed.sql`.

## Última validación

Validaciones vigentes al completar S3.2:

- `npm run app:typecheck`.
- `npm run app:build`.
- `npm --prefix app run smoke`: 14 rutas, cajón móvil y ausencia de errores de consola/hidratación.
- `npm run app:test:inventory-import`: alta manual con categoría y proveedor nuevos, aviso de SKU repetido, importación con una fila válida y una con decimales, y comprobación en PostgreSQL de lo guardado. Limpia sus fixtures al terminar.
- `npm run app:test:inventory`: listado, buscador, los tres filtros, panel con margen en vivo, guardado de precio, ajuste de existencias con su movimiento en PostgreSQL y versión móvil con área táctil de 44 px. Crea y elimina su propio producto de prueba en el negocio demo.
- `npm run app:test:auth`: flujo completo real contra Supabase local y Mailpit.
- `npm run app:test:business-switcher`: dos negocios, contexto visible actualizado y, ya sobre el Inventario real, el negocio nuevo sin productos frente a los 9 del demo; versión móvil y cierre de sesión.
- `npm run app:test:onboarding`: registro, confirmación, login, creación y activación del negocio; comprobación de `OWNER`, categorías y secuencias en PostgreSQL.
- `npm run app:test:settings`: negocio, logo privado, cuenta, contraseña y nuevo login completos desde la interfaz.
- `npm run app:test:session-business`: redirección anónima, onboarding sin membresías, persistencia del negocio y rechazo RLS de un tenant ajeno.
- `npm run db:test`: 191 pruebas SQL (las anteriores más 26 de `void_sale`), 100 códigos concurrentes únicos, 40 ventas concurrentes más 10 anulaciones simultáneas de la misma venta, y las 21 comprobaciones de la Edge Function.
- `supabase db lint`: «No schema errors found».
- Comprobación real sobre PostgREST con el usuario `demo@cashi.local`: cada filtro de `v_product_stats` devuelve lo esperado, `other@cashi.local` no ve nada del negocio demo y el acceso anónimo responde `401 permission denied for view v_product_stats`.
- Comprobación real de `adjust_stock` sobre PostgREST: el ajuste devuelve el nuevo stock, la vista y el movimiento quedan consistentes, delta cero y motivo vacío responden `400` con su mensaje, el `PATCH` directo de `stock` responde `403` y el de `price` sigue funcionando.
- El build solo muestra avisos `DEP0155` de dependencias de Node; no son errores de la aplicación.

## Próximo trabajo: S3.3

Búsqueda de caja y productos frecuentes:

1. `search_products(q)` con máximo 8 resultados, pensada para teclear rápido en la Caja. Devuelve stock y precio.
2. `frequent_products(limit)` por ventas de los últimos 30 días, contando solo las `CONFIRMED`.
3. Ambas acotadas al negocio activo y con el aislamiento probado.
4. Aquí sí puede valer la pena el índice trigram que se dejó pendiente en S2.1: la búsqueda de caja se teclea letra a letra.

## Diseño pendiente

El `PLAN.md` menciona `Prototipo Interactivo.dc.html` y `Mockups Inventario y Ganancias.dc.html`, pero esos archivos no están presentes actualmente en el repositorio. La UI base y F1.1 se construyeron con los tokens descritos en el plan. Antes de decisiones visuales importantes, pedir esos archivos al usuario.
