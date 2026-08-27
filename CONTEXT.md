# Contexto de trabajo — Cashi

Actualizado: 27 de agosto de 2026, después de completar F6.1. **Las Fases 3, 4, 5 y 6 están terminadas**.

## Preferencias del usuario

- Ejecutar comandos y tareas técnicas sin pedir confirmación.
- Preguntar antes de tomar decisiones de negocio o de diseño.
- El producto debe ser genérico; ejemplos de negocios indicados por el usuario: perfumería y tienda de ropa.
- Usar Nuxt 4, Tailwind CSS y PrimeVue.
- Se decidió expresamente usar PrimeVue 4 bajo MIT. No subir a PrimeVue 5 sin revisar nuevamente su licencia con el usuario.
- Para Gastos, ofrecer categorías predefinidas y una opción **Otro** que permita escribir el concepto. `expense.category` se mantiene como texto para no cerrar el catálogo en SQL.

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
| S3.3 | `ff2840c` | `search_products` y `frequent_products` para la Caja |
| F3.1 | `e260579` | Vista Caja: buscador, carrito con margen y cobro |
| F3.2 | `a33a884` | Barra fija de cobro en móvil y área táctil de 44 px |
| S7.1 | `8d7088a` | Rangos de calendario por zona horaria del negocio |
| S4.1 | `fc6b530` | CRUD, filtros y distribución por categoría de Gastos |
| S4.2 | `50eb766` | Vista de deuda y abonos seguros de Fiados |
| F4.1 | `8907ccc` | Vista Gastos con resumen, filtros, alta y versión móvil |
| Mejora F4.1/F2.1 | `98e68bd` | Edición/borrado de gastos y valoración total del inventario |
| F4.2 | `c73d172` | Vista Fiados con resumen, vencidos, lista adaptable y abonos |
| S5.1 | `8c266ef` | CRUD protegido y recepción idempotente de órdenes de compra |
| S5.2 | `cf74bdf` | Sugerencias de reposición con cantidades y costos estimados |
| F5.1 | `524a820` | Vista Compras, creación atómica de sugerencias y recepción desde la interfaz |
| S6.1 | `2df48e1` | Creación de cotizaciones y listados protegidos de resumen/líneas |
| S6.2 | `3b93b3c` | Conversión idempotente de cotizaciones a venta o fiado |
| F6.1 | `5b8f314` | Guardar desde Caja, vigencia efectiva y vista adaptable de Cotizaciones |

La siguiente tarea pendiente del `PLAN.md` es **S7.2 · `metrics_summary`**. S7.1 ya fue completada anticipadamente.

## Qué está construido y qué no

Vistas conectadas a datos reales:

- `/login`, `/registro`, `/recuperar`, `/nueva-contrasena`, `/onboarding`
- `/inventario` — valoración total, listado, filtros, alta, import CSV y panel de edición
- `/caja` — buscador, frecuentes, carrito y cobro
- `/fiados` — cartera total, vencidos, deudores y registro de abonos
- `/gastos` — resumen mensual, distribución, filtros, alta, edición y borrado
- `/compras` — sugerencia de reposición, órdenes pendientes/recibidas y recepción de mercancía
- `/cotizaciones` — valor vigente, listado, conversión a contado/fiado y borrado
- `/ajustes` — negocio, logo, cuenta y contraseña

Todavía son `PagePlaceholder`, sin datos:

- `/` (Resumen), `/reportes`

Backend disponible y **sin interfaz que lo use**: `void_sale`, `v_sale_detail`
(S3.2) y `period_range` (S7.1). La Caja registra ventas pero no hay pantalla para
verlas ni anularlas; eso llega con F7.3 (Reportes) y el visor de documentos de
la Fase 8. La acción Ver/PDF de Cotizaciones informa que el visor llegará en F8.1;
no simula una descarga antes de que exista `document-pdf`.

## Convenciones de trabajo

- Una tarea, un commit: `[ID] título en español`, y a continuación un
  `docs: actualiza contexto tras ID` con este archivo. Ver `git log`.
- Toda migración es aditiva y versionada; no se edita una ya aplicada.
- Ninguna tabla o vista nueva se da por terminada sin su política y su prueba de
  aislamiento entre negocios.
- Toda regla de la §2 del `PLAN.md` que se toque necesita prueba. Dinero y
  periodos no se dan por buenos sin test.

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
npm run app:test:caja
npm run app:test:credits
npm run app:test:expenses
npm run app:test:inventory
npm run app:test:inventory-import
npm run app:test:purchases
npm run app:test:onboarding
npm run app:test:settings
npm run app:test:session-business
npm run db:test
npm run db:test:quote-conversion
npm run db:test:quotes
npm run db:test:sales
npm run db:test:purchases
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
- `v_inventory_summary` agrega todos los productos activos del negocio y devuelve cantidad, unidades, valor al costo y valor potencial de venta. Usa `security_invoker`, por lo que hereda la RLS de `product`; la interfaz muestra `inventory_value = sum(cost × stock)` aunque la lista esté filtrada.
- La vista se declara `with (security_invoker = true)`; sin esa opción correría como su dueño y expondría el catálogo de todos los negocios. Los `grant` iniciales usaron `on all tables`, así que la vista necesita su propio `grant select ... to authenticated`. Ambas cosas están cubiertas por pruebas.
- Reglas aplicadas: stock bajo es `stock < min_stock` estricto (4/4 no es bajo); el margen es `(price − cost) / price` con dos decimales y `null` cuando `price = 0`; margen estrecho es margen bruto por debajo del **20 %**, y también un producto con costo pero sin precio.
- Los filtros del inventario se aplican desde el cliente con PostgREST: `or=(name.ilike.*q*,sku.ilike.*q*)` para la búsqueda, `eq` para categoría y proveedor, `is_low_stock=eq.true` e `is_thin_margin=eq.true` para las banderas. Hay índices `product(business_id, category_id)` y `product(business_id, supplier_id)`.
- El seed incluye `ACC-004 · Bolsa de regalo` (16 % de margen) para que el filtro de margen bajo tenga datos reales.
- `adjust_stock(p_product, p_delta, p_reason)` (migración `20260826160000_adjust_stock.sql`) corrige existencias y escribe el movimiento `ADJUST` en la misma transacción. Devuelve `jsonb` con `product_id`, `previous_stock`, `stock`, `qty_delta`, `reason` y `movement_id`.
- La suma se resuelve dentro del `update` (`stock = stock + p_delta`), no con una lectura previa, para que dos ajustes simultáneos no se pisen.
- El motivo es **obligatorio**: sin él el histórico de movimientos no sirve para auditar. El panel del Inventario ofrece cuatro motivos rápidos (conteo físico, merma, devolución, corrección) más texto libre.
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
- `search_products(p_business, p_q, p_limit)` y `frequent_products(p_business, p_limit, p_days)` **devuelven tabla, no jsonb**, así que los tipos generados traen la forma de la fila y el cliente puede pedir columnas sueltas.
- El orden de la búsqueda es regla de negocio: SKU exacto, luego lo que empieza por el término, luego lo que solo lo contiene, y dentro de cada grupo por nombre. La Caja se teclea a ciegas y el primer resultado importa.
- La búsqueda **no ignora acentos**: buscar «jabon» no encuentra «Jabón facial». Está cubierto por una prueba para que sea una decisión visible y no una sorpresa. Si molesta en uso real, se resuelve con `unaccent`.
- `frequent_products` solo cuenta ventas `CONFIRMED` y dentro de la ventana de días; una venta anulada deja de contar.
- **No se añadió índice trigram**, pese a lo previsto en S2.1: la consulta siempre filtra por `business_id`, los catálogos por negocio son pequeños y un índice GIN encarecería cada escritura del import masivo. Reevaluar con catálogos grandes de verdad.
- Sí se añadió `sale(business_id, status, sold_at)` para que los frecuentes no recorran todo el historial.
- `app/app/stores/cart.ts` guarda el carrito. El precio y el costo que conserva son **una copia para mostrar**: al cobrar solo viaja `[{product_id, qty}]` y `create_sale` resuelve los valores actuales.
- El estimado del carrito resta el descuento igual que el servidor, así que lo que se ve antes de cobrar coincide con lo que queda registrado. Es la única excepción permitida a calcular dinero fuera de Postgres.
- El fiado sin cliente **no se bloquea en el cliente**: se envía y se muestra el error del backend, tal como pide el criterio de F3.1. La prueba filtra el `400` que eso deja en consola.
- Cambiar de negocio vacía el carrito; si no, quedarían productos del negocio anterior en pantalla.
- El generador de tipos **no modela la nulabilidad de los argumentos** de una función SQL: declara `p_customer` y `p_due` como obligatorios aunque acepten null. En `caja.vue` se resuelve con un cast al tipo `Args`, comentado en el sitio.
- En móvil el total y el botón de cobro de la Caja viven en una **barra fija abajo** (`caja-mobile-bar`), y el bloque equivalente del panel se oculta con `max-[760px]:hidden`. Hay un solo sitio donde cobrar en cada tamaño, y los testids se llaman `caja-charge` y `caja-charge-mobile`.
- Los controles de PrimeVue miden **42 px** de alto por defecto, justo por debajo del mínimo táctil de 44 que exige el plan. Hay una regla en `main.css` que los sube en móvil; si se añaden componentes nuevos, conviene comprobarlo.
- Las pruebas que venden **tienen que restaurar el stock de todos los productos que tocan**, no solo de los que comprueban. La prueba de Caja restaura los nueve del seed.
- El seed local incluye `onboarding@cashi.local` sin negocio y `other@cashi.local` con un tenant ajeno para las pruebas automatizadas. Las credenciales están documentadas junto a esos fixtures en `supabase/seed.sql`.
- `period_range(p_timezone, p_period, p_month_offset)` devuelve límites `[from, to)` y el periodo anterior para `today`, `7d` y `month`. Los límites son medianoches reales de la zona indicada, incluso en cambios de horario de verano; `month_offset` positivo navega hacia el pasado.
- La variante determinista `private.period_range_at(..., p_now)` existe solo para pruebas de bordes. No exponerla al cliente ni duplicar el cálculo de fechas en las métricas.
- El CRUD de Gastos se hace directamente sobre `expense` y queda protegido por las políticas RLS existentes. Un trigger recorta espacios de `concept` y `category` antes de guardar.
- `expense_category_totals(p_business, p_from, p_to, p_category)` devuelve `category`, `total_amount`, `expense_count` y `share_pct`. Usa rango local de fechas `[from, to)`; el filtro de categoría es opcional y no distingue mayúsculas, pero el porcentaje siempre se calcula contra todo el rango.
- F4.1 usa categorías predefinidas más **Otro**. Al elegir Otro se habilita el texto del concepto del gasto; no convertir `expense.category` en enum ni en FK sin consultarlo nuevamente.
- `/gastos` usa `period_range` para obtener el mes según `business.timezone`; los límites se convierten a fechas de calendario antes de consultar `expense_category_totals` y la tabla.
- El resumen mensual conserva el lenguaje de los archivos de diseño: total a la izquierda, distribución por barras y acción de alta. La lista usa tabla en escritorio y tarjetas en móvil.
- Los filtros de fecha son inclusivos para el usuario. Como `spent_at` es `date`, la consulta traduce el final a `< día siguiente`, evitando perder gastos del último día.
- Las categorías predefinidas viven en `app/app/utils/expenses.ts`: Arriendo, Servicios, Publicidad, Nómina, Insumos, Domicilios, Transporte, Impuestos y Otro. El concepto se conserva para todas las categorías y **Otro** muestra ayuda específica para texto libre.
- El seed incluye cinco gastos del mes local del negocio demo, dos de ellos recurrentes. Las fechas se calculan al ejecutar el seed para que la pantalla nunca nazca vacía por el paso del tiempo.
- `app/tests/expenses-flow.mjs` comprueba el total y distribución, filtros combinables, alta de Otro, fecha predeterminada según la zona del negocio, persistencia en PostgreSQL y tarjetas móviles con objetivos táctiles de 44 px. El fixture creado se elimina al terminar.
- El mismo modal de Gastos sirve para crear y editar, precargando categoría, concepto, monto, fecha y recurrencia. El borrado siempre pasa por un diálogo explícito de confirmación; ambas acciones refrescan lista y resumen en paralelo.
- `v_credits` devuelve solo clientes con deuda positiva: `customer_id`, `business_id`, nombre/teléfono, `total_credit`, `total_paid`, `debt`, cantidad de ventas fiadas, vencimiento pendiente más antiguo, bandera/días de mora y últimas fechas de venta y abono.
- La deuda suma únicamente ventas `CREDIT` con estado `CONFIRMED`; las ventas anuladas y las ventas por otros métodos no cuentan. Un cliente totalmente pagado desaparece de la vista.
- Los abonos generales del cliente cubren primero las ventas con `due_date` más antiguo. Así, una factura vieja ya cubierta no mantiene al cliente marcado como vencido por error. Las ventas sin vencimiento quedan al final y nunca se marcan vencidas por sí mismas.
- El vencimiento compara `due_date` con la fecha actual en `business.timezone`, no con UTC. La prueba fija el mismo instante para Kiritimati y Honolulu y obtiene resultados distintos según el día local.
- `register_payment(p_business, p_customer, p_amount, p_method)` acepta `CASH`, `TRANSFER` o `CARD`, bloquea la fila del cliente, guarda el abono y devuelve `previous_debt` y `debt`. Dos llamadas simultáneas no pueden sobrepagar.
- `authenticated` conserva lectura sobre `payment`, pero ya no puede insertar, editar ni borrar abonos directamente; toda escritura pasa por `register_payment` para mantener el historial y el saldo.
- Triggers privados rechazan cualquier operación que deje pagos mayores que las ventas fiadas confirmadas. En particular, `void_sale` no permite anular una venta ya pagada si eso dejaría deuda negativa; la venta permanece confirmada.
- `credit_dashboard_summary(p_business, p_from, p_to)` calcula en PostgreSQL el total por cobrar, número de deudores, vencidos, deuda vencida y abonos del periodo. No suma la página cargada en el navegador, así que el resultado no depende de límites de PostgREST.
- `/fiados` obtiene el mes local mediante `period_range`, carga `v_credits` y muestra tres tarjetas: Por cobrar, Clientes con deuda y Abonado este mes. Los vencidos aparecen primero y cada fila conserva teléfono, comprado, deuda, estado y último abono.
- En escritorio los deudores usan `UiDataTable`; por debajo de 760 px cambian a `UiCardList` con una acción de Abonar de ancho completo y objetivos táctiles de al menos 44 px.
- `CreditsCreditPaymentModal` valida monto entero positivo y método (`CASH`, `TRANSFER`, `CARD`). **Abonar todo** precarga la deuda exacta; el servidor vuelve a validar el saldo mediante `register_payment` para impedir sobrepagos concurrentes.
- Tras un abono se recargan lista y resumen en paralelo. Si el saldo llega a cero, el cliente desaparece porque `v_credits` solo devuelve deuda positiva.
- El seed incluye tres fiados demo: $790.000 por cobrar, un cliente vencido con $350.000 y un abono de $100.000 en el mes local. Sus códigos `DEMO-CRED-*` permiten que las pruebas de Caja sigan aislando sus ventas `FAC-*`.
- `app/tests/credits-flow.mjs` comprueba los totales iniciales, el estado vencido, la precarga exacta de $280.000, persistencia del abono con tarjeta, salida del cliente, reducción exacta a $510.000 y actualización del abono mensual a $380.000. También valida tarjetas móviles y limpia su pago al terminar.
- Los miembros pueden crear, editar y eliminar órdenes `PENDING`; también pueden cancelarlas. Una orden `RECEIVED` queda inmutable, y una `CANCELLED` no puede reabrirse ni recibirse.
- Las políticas de `purchase_line` exigen que la orden siga pendiente y que el producto pertenezca al mismo negocio. Las órdenes tampoco aceptan proveedores de otro tenant. `authenticated` no puede escribir `received_at`, cambiar el código/negocio ni marcar `RECEIVED` directamente.
- `receive_purchase_order(p_order)` bloquea primero la orden. Si ya está recibida retorna sin efectos; si está cancelada o vacía falla. Recorre productos por UUID para evitar deadlocks, suma `qty` al stock, reemplaza el costo actual con `unit_cost`, escribe movimientos `PURCHASE` y finalmente guarda estado y fecha de recepción.
- El costo actualizado solo afecta ventas futuras: las ventas históricas conservan el `unit_cost` congelado en `sale_line`, conforme a la regla central del plan.
- `supabase/tests/receive-purchase-order.concurrent.cjs` lanza diez recepciones simultáneas de la misma orden y exige exactamente dos movimientos, 12 unidades y un único cambio de costo/stock.
- `suggest_purchase(p_business)` devuelve JSON con `product_count`, `total_units`, `estimated_total` y `lines`. Cada línea conserva producto, SKU, categoría, proveedor, stock, mínimo, cantidad sugerida, costo unitario y costo estimado.
- Solo sugiere productos activos con `stock < min_stock`; estar exactamente en el mínimo no cuenta. La cantidad se calcula en PostgreSQL como `max(min_stock × 2 − stock, 1)`, incluso con stock negativo, y un costo actual de cero mantiene la línea con estimado cero.
- En el seed demo la sugerencia es CUI-002 × 7 y ACC-003 × 6: 13 unidades por $108.500. Las 24 pruebas de S5.2 cubren fórmula, agregados, proveedor por línea, límite estricto, stock negativo, costo cero, inactivos, sesión e aislamiento.
- El prototipo interactivo define que **Crear orden sugerida** crea una sola orden con la etiqueta “Varios proveedores”. En F5.1 la orden mixta puede usar `supplier_id = null`; la interfaz debe derivar esa etiqueta de las líneas, sin borrar la información de proveedor que entrega `suggest_purchase`.
- `create_suggested_purchase_order(p_business)` bloquea los productos con stock bajo en orden UUID y crea atómicamente una sola orden `PENDING` con todas sus líneas. Obtiene el código `OC-` mediante `next_doc_code`, no modifica existencias ni costos al crear y rechaza negocios sin sugerencias.
- `v_purchase_orders` concentra los totales exactos de cada orden (`line_count`, `total_units`, `total_cost`) y muestra “Varios proveedores” cuando una orden con líneas no tiene `supplier_id`. La vista usa `security_invoker` y conserva el aislamiento RLS.
- `/compras` sigue el prototipo: banner de reposición, creación de la orden sugerida, tabla de escritorio, tarjetas móviles y acción **Recibir** para órdenes pendientes. Al recibir, recarga simultáneamente órdenes y sugerencia.
- La recepción continúa siendo el único punto que cambia stock y costo actual. La pantalla recuerda que las ventas históricas conservan el costo congelado de su `sale_line`.
- `app/tests/purchases-flow.mjs` comprueba la sugerencia demo (2 productos, 13 unidades, $108.500), creación de `OC-0001` sin alterar inventario, recepción única, movimientos y costos exactos, desaparición de la sugerencia y controles móviles de al menos 44 px. Limpia el fixture al terminar.
- `create_quote(p_business, p_customer, p_lines, p_valid_until)` crea una cotización `OPEN` con código `COT-`, agrupa productos repetidos y congela nombre, precio y costo. El cliente es opcional y la fecha de vigencia es obligatoria.
- Crear una cotización **no** cambia existencias, no escribe `stock_movement` y no crea una venta. Los productos se bloquean por UUID mientras se toma el snapshot para que precio, costo y total sean coherentes incluso ante ediciones simultáneas.
- La RPC rechaza productos inactivos o ajenos, clientes de otro tenant, cantidades nulas, negativas, fraccionarias o fuera de `integer`, y montos que excedan `bigint`. Las validaciones ocurren antes de consumir el código correlativo.
- `authenticated` ya no puede insertar o editar `quote` ni escribir `quote_line` directamente: toda creación pasa por la RPC para impedir que `total` y snapshots diverjan. El borrado directo sigue permitido solo para cotizaciones `OPEN`, como exige la acción Eliminar de F6.1.
- `v_quote_detail` entrega cliente/“Sin cliente”, vigencia, estado, cantidad de líneas/unidades, total, ganancia congelada y detalle legible. `v_quote_line_detail` entrega cada línea con `line_total` y `line_profit`. Ambas vistas usan `security_invoker` y heredan RLS.
- `supabase/tests/create-quote.concurrent.cjs` crea 40 cotizaciones simultáneas y exige 40 códigos únicos consecutivos sin cambios en stock, movimientos ni ventas; elimina sus documentos y restaura la secuencia al terminar.
- `convert_quote(p_quote, p_method, p_due)` bloquea la fila de la cotización antes de actuar. Si está `OPEN`, llama a `create_sale`, enlaza `sale.quote_id` y marca la cotización `CONVERTED`; si ya estaba convertida devuelve la misma venta sin repetir efectos.
- Un índice único parcial sobre `sale(quote_id)` garantiza físicamente una sola venta por cotización, incluso ante errores de integración o solicitudes simultáneas.
- La conversión sigue literalmente el contrato de `create_sale`: usa **precio, costo, nombre y categoría vigentes al cobrar**. La cotización conserva por separado sus snapshots y total originales para el documento; si el catálogo cambió, el total de la venta puede diferir del cotizado.
- `p_due` solo se conserva al convertir a `CREDIT`. El fiado exige que la cotización tenga cliente; una conversión rechazada deja la cotización abierta, el stock intacto y no consume código `FAC-`.
- Cotizaciones `CANCELLED` o `EXPIRED` no se convierten. Por decisión del usuario, una cotización `OPEN` cuya `valid_until` ya pasó se presenta como **Vencida** y se bloquea su conversión.
- `supabase/tests/convert-quote.concurrent.cjs` dispara 20 conversiones simultáneas de la misma cotización y exige una venta, una línea, un movimiento, un código consumido y un solo descuento de stock. Limpia todos sus fixtures y restaura la secuencia.
- La vigencia es efectiva, no un cron que reescribe filas: `v_quote_detail` y `v_quote_line_detail` derivan `EXPIRED` comparando `valid_until` con la fecha actual de `business.timezone`. El estado persistido sigue `OPEN`, de modo que una vencida puede eliminarse con la política existente.
- El trigger `validate_sale_quote_link` vuelve a comprobar estado, negocio y fecha local dentro de la transacción que enlaza `sale.quote_id`. Si la cotización venció con la pantalla abierta, toda la creación de venta se revierte: no quedan venta, movimientos, descuento de stock ni código consumido.
- Caja ofrece **Guardar cotización**. Abre un modal con vigencia predeterminada de 15 días y mínimo hoy según la zona del negocio; usa el carrito y cliente actuales, limpia al guardar y navega a `/cotizaciones`.
- Las cotizaciones no tienen descuento. Si el carrito tiene uno, Caja bloquea la apertura del modal y pide retirarlo; el total cotizado es el subtotal completo.
- `/cotizaciones` suma solo documentos vigentes, conserva las vencidas visibles y presenta tabla en escritorio/tarjetas en móvil. Cobrar y A fiado llaman a `convert_quote`; A fiado queda desactivado sin cliente y ambas conversiones quedan desactivadas al vencer. Ver/PDF muestra el límite temporal de F8.1 y Eliminar exige confirmación.
- `app/tests/quotes-flow.mjs` cubre descuento bloqueado, vigencia de 15 días, creación sin efecto contable, conversión a fiado y contado, estado vencido, eliminación, acción documental pendiente y objetivos táctiles móviles de 44 px. Limpia ventas, movimientos, cotizaciones, secuencias y stock.

## Última validación

Validaciones vigentes al completar F6.1:

- `npm run app:typecheck`.
- `npm run app:build`.
- `npm --prefix app run smoke`: 14 rutas, cajón móvil y ausencia de errores de consola/hidratación.
- `npm run app:test:caja`: búsqueda por nombre y por SKU, carrito con ± y margen, descuento, rechazo del fiado sin cliente con el mensaje del backend, cobro con cliente, venta y stock comprobados en PostgreSQL, venta sin existencias con aviso, vaciar carrito y frecuentes actualizados. En móvil comprueba que la barra de cobro queda anclada abajo, que el botón de escritorio no está visible y que ningún control baja de 44 px. Borra las ventas y restaura el stock del seed.
- `npm run app:test:credits`: resumen de $790.000, tres deudores, un vencido, abono completo de $280.000, desaparición del cliente, cartera final de $510.000, actualización del total mensual y versión móvil sin controles menores de 44 px. No deja fixtures.
- `npm run app:test:expenses`: total mensual y distribución por categoría, filtro de categoría, rango de un solo día, alta y edición real con Otro y recurrente, borrado confirmado, persistencia en PostgreSQL, actualización inmediata del resumen y tarjetas móviles. No deja fixtures.
- `npm run app:test:inventory-import`: alta manual con categoría y proveedor nuevos, aviso de SKU repetido, importación con una fila válida y una con decimales, y comprobación en PostgreSQL de lo guardado. Limpia sus fixtures al terminar.
- `npm run app:test:inventory`: valoración completa al costo independiente de los filtros, listado, buscador, los tres filtros, panel con margen en vivo, guardado de precio, actualización del total al ajustar existencias, movimiento en PostgreSQL y versión móvil con área táctil de 44 px. Crea y elimina su propio producto de prueba en el negocio demo.
- `npm run app:test:purchases`: crea la orden sugerida mixta, comprueba que no cambie stock al crear, la recibe desde la interfaz, valida stock/costos/movimientos en PostgreSQL y la tarjeta móvil accesible. No deja fixtures.
- `npm run app:test:quotes`: guarda desde Caja con vigencia de 15 días, bloquea descuento, comprueba cero efectos de inventario al guardar, convierte a fiado y contado, bloquea vencidas, elimina y valida acciones móviles de 44 px. No deja fixtures.
- `npm run app:test:auth`: flujo completo real contra Supabase local y Mailpit.
- `npm run app:test:business-switcher`: dos negocios, contexto visible actualizado y, ya sobre el Inventario real, el negocio nuevo sin productos frente a los 9 del demo; versión móvil y cierre de sesión.
- `npm run app:test:onboarding`: registro, confirmación, login, creación y activación del negocio; comprobación de `OWNER`, categorías y secuencias en PostgreSQL.
- `npm run app:test:settings`: negocio, logo privado, cuenta, contraseña y nuevo login completos desde la interfaz.
- `npm run app:test:session-business`: redirección anónima, onboarding sin membresías, persistencia del negocio y rechazo RLS de un tenant ajeno.
- `npm run db:test`: 517 pruebas SQL, incluidas 13 de vigencia efectiva, 51 de creación/listados y 46 de conversión de cotizaciones; 100 códigos concurrentes únicos, 40 ventas concurrentes más 10 anulaciones simultáneas de la misma venta, 40 cotizaciones concurrentes sin efectos contables, 20 conversiones simultáneas idempotentes, carrera de dos abonos, 10 recepciones concurrentes de una orden y las 21 comprobaciones de la Edge Function.
- `npx supabase db lint`: sin errores; conserva dos avisos porque las columnas `from` y `to` de `period_range` son palabras reservadas, pero esos nombres forman parte del contrato del `PLAN.md` y están correctamente entrecomillados.
- Comprobación real sobre PostgREST con el usuario `demo@cashi.local`: cada filtro de `v_product_stats` devuelve lo esperado, `other@cashi.local` no ve nada del negocio demo y el acceso anónimo responde `401 permission denied for view v_product_stats`.
- Comprobación real de `adjust_stock` sobre PostgREST: el ajuste devuelve el nuevo stock, la vista y el movimiento quedan consistentes, delta cero y motivo vacío responden `400` con su mensaje, el `PATCH` directo de `stock` responde `403` y el de `price` sigue funcionando.
- El build solo muestra avisos `DEP0155` de dependencias de Node; no son errores de la aplicación.

## Próximo trabajo: S7.2

Implementar `metrics_summary` con ventas, ganancia bruta, gastos, ganancia neta y por cobrar, además de los porcentajes y la comparación contra el rango anterior. Debe reutilizar `period_range` (S7.1), respetar `business.timezone` y mantener coherencia entre `gross_margin`, `expense_ratio` y `net_margin`.

## Fuentes de diseño disponibles

- `Prototipo Interactivo.dc.html` — comportamiento, jerarquía, tabla/tarjetas y modales.
- `Mockups Inventario y Ganancias.dc.html` — composición visual, barras de distribución y tratamiento de estados recurrentes.

Ambos archivos están versionados desde F4.1 y son la fuente visual del `PLAN.md`. Consultarlos antes de tomar decisiones visuales en las siguientes vistas.
