# Contexto de trabajo — Cashi

Actualizado: 27 de agosto de 2026, después de completar X9.1. **Las Fases 0 a 8 están terminadas** y la Fase 9 de cierre está empezada. **Las Fases 3, 4, 5 y 6 están terminadas** **la Fase 7 está terminada**: no queda ninguna vista sin datos reales.

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
| S7.2 | `4400fee` | Resumen financiero, cartera y comparativas contra el periodo anterior |
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
| S7.3 | `8a61087` | Series diarias, rentabilidad por producto y categoría, y alertas operativas |
| — | `94c11a9` | Prueba del selector reparada tras convertir Gastos en vista real |
| F7.1 | `a0ab9ad` | Vista Resumen: KPIs, gráfica de 14 días, rentabilidad, últimas ventas y alertas |
| F7.2 | `b168fb4` | Selector de periodo con segmentado, flechas y 18 meses navegables |
| F7.3 | `217e7e1` | Vista Reportes: cifras, ganancia por categoría, mejor/peor, historial y CSV |
| — | `ca0af42` | Puerto propio para las tres pruebas que chocaban con el servidor de desarrollo |
| S8.1 | `a0c0443` | Edge Function `document-pdf`: plantilla única de factura y cotización |
| F8.1 | `6d5c87d` | Visor de documentos con descarga de PDF e imagen y conversión de cotizaciones |
| X9.1 | `2f956af` | Pantalla de sesión expirada y repaso de estados vacíos |

La siguiente tarea pendiente del `PLAN.md` es **X9.2 · Pruebas E2E**.

## Qué está construido y qué no

Vistas conectadas a datos reales:

- `/login`, `/registro`, `/recuperar`, `/nueva-contrasena`, `/onboarding`
- `/inventario` — valoración total, listado, filtros, alta, import CSV y panel de edición
- `/caja` — buscador, frecuentes, carrito y cobro
- `/fiados` — cartera total, vencidos, deudores y registro de abonos
- `/gastos` — resumen mensual, distribución, filtros, alta, edición y borrado
- `/compras` — sugerencia de reposición, órdenes pendientes/recibidas y recepción de mercancía
- `/cotizaciones` — valor vigente, listado, conversión a contado/fiado y borrado
- `/` (Resumen) — selector de periodo, KPIs, gráfica de 14 días, rentabilidad por producto, últimas ventas y alertas navegables
- `/reportes` — cifras del periodo, ganancia por categoría, mejor y peor producto, historial y exportación CSV
- `/ajustes` — negocio, logo, cuenta y contraseña

**Ninguna vista queda como `PagePlaceholder`.** Al conectar `/reportes` el
componente se quedó sin ningún consumidor y se eliminó; el `data-testid`
`active-business-name` que usaban tres pruebas vive ahora en el encabezado del
Resumen.

Backend disponible y **sin interfaz que lo use**: solo `void_sale` (S3.2). El
visor muestra la venta pero no la anula; el plan no lo pide en ninguna tarea, así
que conviene decidirlo con el usuario antes de darlo por terminado. La acción Ver/PDF de Cotizaciones informa que el visor llegará en F8.1;
no simula una descarga antes de que exista `document-pdf`.

## Convenciones de trabajo

- Una tarea, un commit: `[ID] título en español`, y a continuación un
  `docs: actualiza contexto tras ID` con este archivo. Ver `git log`.
- Toda migración es aditiva y versionada; no se edita una ya aplicada.
- Ninguna tabla o vista nueva se da por terminada sin su política y su prueba de
  aislamiento entre negocios.
- Toda regla de la §2 del `PLAN.md` que se toque necesita prueba. Dinero y
  periodos no se dan por buenos sin test.

## Documentos

- `supabase/functions/document-pdf` genera factura y cotización con **una sola
  plantilla**: encabezado del negocio con logo, identificación a la derecha,
  tabla de líneas, totales y nota. Se pide con `POST { type, id }`.
- Usa la sesión de quien llama, nunca la `service_role`: si la RLS no deja ver
  la venta, la función responde 404. El logo se descarga del bucket privado con
  esa misma sesión, y una ruta rota no impide componer el documento.
- El documento nunca imprime costos ni ganancia: es un papel para el cliente.
- `pdf-lib` y `@pdf-lib/fontkit`, ambas MIT, elegidas con el usuario. Supabase
  corre Deno sin navegador, así que Puppeteer no era opción.
- Las tipografías viajan como base64 en `_shared/fonts/index.ts`, generado por
  `build-fonts.cjs`. Dos motivos, los dos documentados en ese script: el runtime
  solo empaqueta módulos importados —un `.ttf` suelto no llega al worker— y
  `@pdf-lib/fontkit` no descomprime los WOFF de `@fontsource`, así que hay que
  reconstruir la TTF. IBM Plex es OFL 1.1 y su licencia viaja al lado.
- **No se usa `subset: true`**: el subsetter de fontkit falla dentro del runtime
  de Edge Functions aunque funcione en Deno a secas. Con las tres fuentes
  completas el PDF pesa unos 69 kB, muy por debajo del techo de 300 kB.
- `_shared/document.ts` es lógica pura y se prueba desde Node con
  `--experimental-strip-types`, sin dependencias nuevas.
- `npm run db:test:documents` cubre las 25 reglas del modelo (totales, notas,
  sellos de ANULADA/VENCIDA/CONVERTIDA, paginación) y 20 del contrato HTTP
  (sesión, método, tipo, aislamiento, tamaño, nombre de archivo y logo).
- `DocumentsDocumentViewer` es el visor: se abre desde Cotizaciones (Ver/PDF),
  Resumen (últimas ventas) y Reportes (historial). Cierra con Escape, con clic
  fuera, con Cerrar y **al cambiar de sección**, como pide el plan.
- El papel del visor está maquetado con **estilos en línea a propósito**: la
  exportación a PNG serializa ese nodo dentro de un SVG `foreignObject` y ahí no
  llega ninguna hoja de estilos externa. Tampoco llegan las tipografías web ni
  las imágenes remotas, por eso el logo se incrusta como `data:`. Si el
  navegador rechaza el SVG, el visor avisa y sugiere el PDF en vez de romperse.
- **El visor y la plantilla del PDF cuentan lo mismo pero no comparten código**:
  Deno no puede importar de `app/app` ni Nuxt de `supabase/functions`. Las notas
  y los sellos están duplicados en `app/app/utils/documents.ts` y en
  `supabase/functions/_shared/document.ts`; si cambia una regla, hay que
  cambiarla en los dos sitios. Las dos pruebas lo verifican por separado.
- Desde una cotización vigente el visor convierte a venta o a fiado con
  `convert_quote`, la misma RPC de `/cotizaciones`. Sin cliente, «Convertir en
  fiado» queda desactivado; vencida o convertida, no aparece ninguno de los dos.

## Sesión expirada

- Una sesión que se cae lleva a `/login?expired=1&redirect=<destino>`, con aviso
  en la propia pantalla de login y vuelta al destino tras entrar de nuevo.
- Hay **dos caminos y los dos están cubiertos**, porque ninguno cubre al otro:
  - Con la pestaña abierta, Supabase reintenta el refresco cada ~30 s y, al
    fallar, emite `SIGNED_OUT`; lo escucha `plugins/session-expiry.client.ts`.
  - Al recargar con la sesión ya muerta no llega ningún evento: el middleware
    redirige antes. Por eso `auth.global.ts` deja la cookie `cashi.session-seen`
    mientras hay sesión y la consume al redirigir. Es cookie y no
    `localStorage` porque esa decisión también se toma en el servidor.
- `authStore.signingOut` distingue el cierre voluntario del impuesto: sin esa
  bandera, quien pulsa «Cerrar sesión» vería un aviso que no le corresponde. El
  cierre voluntario también borra la marca.
- `useSupabaseRequest` desvía a la misma pantalla cuando una consulta responde
  con el JWT vencido (`PGRST301`, `session_not_found`…), en vez de mostrar un
  Toast rojo sobre una pantalla que ya no sirve. En rutas anónimas no desvía:
  ahí el error sí se muestra.
- Los estados vacíos ya existían vista por vista y se revisaron uno a uno; no
  hizo falta añadir ninguno. Los errores de RPC ya salían por Toast desde F0.2.

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
npm run app:test:dashboard
npm run app:test:documents
npm run app:test:expenses
npm run app:test:inventory
npm run app:test:inventory-import
npm run app:test:purchases
npm run app:test:quotes
npm run app:test:session-expired
npm run app:test:reports
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
- `metrics_summary(p_business, p_period, p_month_offset)` devuelve el contrato JSON del plan con rango local `[from, to)`, ingresos, ganancia bruta, gastos, ganancia neta, cartera, conteos y siete porcentajes/comparativas redondeados a una decimal.
- Solo cuentan ventas `CONFIRMED`. La ganancia usa `sale_line.unit_price` y `unit_cost` congelados y resta `sale.discount` una sola vez por venta; una venta anulada no aporta ingresos, ganancia ni conteo.
- Los gastos se cortan por `expense.spent_at` usando las fechas de calendario de la zona del negocio. Así, ventas (`timestamptz`) y gastos (`date`) comparten exactamente el periodo definido por `period_range`.
- `receivable` y `debtors_count` son una fotografía global actual, independiente del periodo navegado: crédito confirmado menos abonos, limitado a cero por cliente. Un cliente pagado por completo no cuenta como deudor.
- `revenue_change` y `net_profit_change` comparan montos en porcentaje. `gross_margin`, `expense_ratio` y `net_margin` describen el periodo actual; los cambios de margen/proporción se entregan en puntos porcentuales. Un divisor cero produce `0`, siguiendo el prototipo y manteniendo completo el contrato JSON.
- `private.metrics_summary_at` comparte la implementación con la RPC pero acepta un reloj explícito para pruebas deterministas. No tiene permisos para `authenticated`; `public.metrics_summary` usa `current_timestamp`, valida membresía y es la única entrada cliente.
- `supabase/tests/metrics_summary.test.sql` aporta 36 casos sobre límites locales, mes anterior, descuentos, anulaciones, costo congelado, gastos, cartera global, cliente saldado, coherencia de márgenes, periodo vacío, sesión, permisos y aislamiento.
- `metrics_daily(p_business, p_days)` devuelve una serie continua de días locales terminada en hoy, entre 1 y 366 días, con `revenue`, `gross_profit` y `sales_count`; rellena con cero los días sin ventas confirmadas.
- `metrics_products(p_business, p_period, p_month_offset, p_limit)` y `metrics_categories(p_business, p_period, p_month_offset)` obtienen su rango de `private.period_range_at`, **el mismo de `metrics_summary`**. Devuelven `range.from`, `range.to` y `range.label` para que la interfaz titule el periodo sin recalcularlo. El límite de productos va de 1 a 100 y se aplica después de agregar y ordenar.
- Las tres comparten `private.metric_sale_lines`, que reparte el descuento de cada venta **por línea** en proporción a su ingreso bruto: parte entera por `floor` y el residuo —siempre menor que el número de líneas— por mayor fracción y luego por `line_id`. Así la suma de líneas reconcilia exactamente con `metrics_summary`, sin céntimos perdidos. Hay pruebas que comparan ambas sumas.
- El histórico sobrevive al producto: las líneas se agrupan por `product_key`, que es el `product_id` o, si el producto fue borrado, su nombre y categoría congelados. Un producto eliminado conserva su nombre y aparece con `product_id` nulo.
- `metrics_alerts(p_business)` agrupa cuatro tipos en orden operativo fijo —`LOW_STOCK`, `OVERDUE_CREDIT`, `PENDING_PURCHASE`, `THIN_MARGIN`—, cada uno con `count`, `title` en español, `target` navegable y hasta cinco `items` de detalle. Un grupo sin filas no aparece.
- Las alertas repiten deliberadamente tres reglas ya escritas en otro sitio, porque una vista `security_invoker` invocada dentro de una función `security definer` correría como el dueño y saltaría la RLS: el reparto FIFO de abonos de `v_credits`, el umbral de margen del 20 % de `v_product_stats` y la fórmula `greatest(min_stock * 2 - stock, 1)` de `suggest_purchase`. **Si alguna de esas tres reglas cambia, hay que cambiarla también aquí.**
- `metrics_alerts` apunta a `/inventario?filter=low` y `/inventario?filter=thin`. `/inventario` todavía no lee esos parámetros de consulta; conectarlos es parte de F7.1.
- Cada RPC tiene su variante `private.*_at` con reloj explícito para pruebas deterministas, sin permisos para `authenticated`. Solo las cuatro funciones `public` se exponen al cliente.
- `/` consume `metrics_summary`, `metrics_daily(14)`, `metrics_products` y `metrics_alerts`, más las últimas seis ventas de `v_sale_detail`. Cada panel carga y falla por separado: un error de alertas no vacía los KPI.
- El periodo vive en la página como `period` (`today` por defecto, igual que el prototipo) y `monthOffset`, y `DashboardPeriodSelector` los mueve con `v-model`.
- Cambiar de periodo recarga **solo** el resumen y la rentabilidad. La gráfica son siempre los últimos 14 días, y las alertas, la cartera y las últimas ventas son una foto de hoy.
- Las flechas y el selector de mes solo existen en el periodo `mes`; moverlos cambia el periodo a `mes`. La flecha adelante se desactiva en el mes actual y la de atrás en el mes 17, que es el más antiguo de los 18 que ofrece el selector.
- `monthOffsetOptions` construye las etiquetas desde el mes en curso **del negocio**, no del navegador, y repite el arreglo de meses de `private.period_label` para que el selector y `metrics_summary` escriban el mismo mes igual. Si se toca uno hay que tocar el otro.
- `month_offset` se ignora en `today` y `7d`, así que cambiar de periodo no necesita reiniciarlo: el mes elegido sigue ahí al volver a `mes`.
- La gráfica son barras CSS, sin librería: es lo que hace el prototipo. Las dos barras de cada día se escalan contra la venta más alta de la serie, nunca cada una contra su propio máximo, para que una ganancia alta no parezca mayor que la venta.
- `app/app/utils/metrics.ts` valida una sola vez la forma de los cuatro `jsonb` y expone tipos; ninguna cifra se recalcula en el cliente. También fija los cuatro números de la vista: 14 días, 6 productos, 6 ventas recientes.
- El KPI **Por cobrar** navega a `/fiados` y es la única cifra que no depende del periodo: es una foto de hoy, y así lo dice su subtítulo.
- Cada alerta lleva a su sección. `/inventario` lee `?filter=low` y `?filter=thin` desde la URL y deja el filtro aplicado al llegar.
- Las últimas ventas muestran código, artículos y cliente porque `v_sale_detail` no expone el nombre del primer producto. Al tocar una venta se avisa que el visor llega en F8.1, igual que en Cotizaciones.
- `/reportes` usa el mismo `UiPeriodSelector` pero abre en **mes en curso**, no en Hoy: es una vista de análisis, no de operación del día.
- Las cuatro cifras salen de `metrics_summary`. El costo de venta no viaja en el contrato: es `revenue - gross_profit`, y su peso sobre los ingresos es el complemento exacto del margen bruto.
- La ganancia por categoría es el único consumidor de `metrics_categories`. La barra compara contra la categoría más rentable del periodo; una ganancia negativa no dibuja barra para no invertir la escala.
- El mejor y el peor producto son el primero y el último de `metrics_products`, que ya llega ordenado por ganancia. Se pide con `p_limit = 100`, el techo de la RPC: un negocio que venda más de cien productos distintos en un periodo vería como «menos rentable» el número cien. Está anotado en `utils/reports.ts`.
- Con un solo producto vendido no se muestra «menos rentable»: sería el mismo que el mejor.
- El historial se corta con los instantes exactos de `period_range`, no con fechas convertidas en el cliente. Es la razón de que la vista llame a esa RPC además de a `metrics_summary`.
- El CSV se arma en el cliente (`buildSalesCsv`) y se descarga con un `Blob`: separador `;` y BOM para que Excel en español lo abra con columnas y tildes correctas, y montos enteros sin formato para que la hoja pueda sumarlos.
- `app/tests/reports-flow.mjs` crea dos ventas de hoy en tres categorías —una con descuento— y comprueba las cuatro cifras contra `metrics_summary`, el orden de las categorías, el mejor y el peor producto, el historial, el aviso documental, el contenido real del CSV descargado, el cambio de periodo y la versión móvil. No deja fixtures.
- `app/tests/dashboard-flow.mjs` crea una venta de hoy con `create_sale`, comprueba KPIs, margen, las 14 barras con la de hoy etiquetada, el orden de la rentabilidad, la venta reciente y su aviso documental, los tres grupos de alertas con su orden operativo, la navegación a Inventario con cada filtro, el selector de periodo completo (mes actual, mes anterior, los 18 meses, flechas y vuelta a Hoy) y la versión móvil con segmentado de ancho completo, etiquetas cortas, sin desbordes ni controles bajo 44 px. Las etiquetas de mes se calculan en la prueba para no depender de la fecha real; los importes se leen de `metrics_summary`. Borra la venta y restaura el stock del seed.
- `supabase/tests/metrics_detail.test.sql` aporta 73 casos sobre reparto del descuento, serie continua con días en cero, productos y categorías reconciliados contra `metrics_summary`, producto borrado, márgenes indefinidos, los cuatro grupos de alertas con sus bordes (vence hoy no está vencido, orden recibida excluida, producto inactivo excluido), límites de entrada, permisos y aislamiento.

## Última validación

Validaciones vigentes al completar X9.1:

- `npm run app:typecheck`.
- `npm run app:build`.
- `npm --prefix app run smoke`: 14 rutas, cajón móvil y ausencia de errores de consola/hidratación.
- `npm run app:test:reports`: cuatro cifras del mes, ganancia por categoría ordenada, mejor y peor producto, historial del periodo, aviso documental, CSV descargado y verificado línea por línea, cambio a Hoy y versión móvil accesible.
- `npm run app:test:session-expired`: primera visita sin aviso, recarga con la sesión muerta con aviso y destino conservado, vuelta al destino tras entrar, aviso una sola vez, cierre de sesión voluntario sin aviso y caída de la sesión con la pestaña abierta. No deja fixtures.
- `npm run app:test:documents`: abre el documento de una venta desde el Resumen, comprueba encabezado, líneas, total y nota, descarga el PDF real de la Edge Function y la imagen PNG generada en el cliente, cierra con Escape, comprueba que cambiar de sección lo cierra, abre una cotización vencida con su sello y sin conversiones, y convierte una vigente a venta comprobando el resultado en PostgreSQL. En móvil verifica que no desborda y que sus botones llegan a 44 px. No deja fixtures.
- `npm run app:test:dashboard`: KPIs de la venta del día, margen del 40 %, gráfica de 14 días, rentabilidad ordenada, última venta con su aviso documental, tres alertas en orden, navegación filtrada a Inventario y el selector de periodo con sus 18 meses; en móvil, dos columnas de KPI, segmentado de ancho completo, sin desbordes y sin controles bajo 44 px.
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
- `npm run db:test`: 626 pruebas SQL más las 45 comprobaciones de `document-pdf`, incluidas 73 de `metrics_detail` y 36 de `metrics_summary`, 13 de vigencia efectiva, 51 de creación/listados y 46 de conversión de cotizaciones; 100 códigos concurrentes únicos, 40 ventas concurrentes más 10 anulaciones simultáneas de la misma venta, 40 cotizaciones concurrentes sin efectos contables, 20 conversiones simultáneas idempotentes, carrera de dos abonos, 10 recepciones concurrentes de una orden y las 21 comprobaciones de la Edge Function.
- `npx supabase db lint`: sin errores; conserva dos avisos porque las columnas `from` y `to` de `period_range` son palabras reservadas, pero esos nombres forman parte del contrato del `PLAN.md` y están correctamente entrecomillados.
- Comprobación real sobre PostgREST con el usuario `demo@cashi.local`: cada filtro de `v_product_stats` devuelve lo esperado, `other@cashi.local` no ve nada del negocio demo y el acceso anónimo responde `401 permission denied for view v_product_stats`.
- Comprobación real de `adjust_stock` sobre PostgREST: el ajuste devuelve el nuevo stock, la vista y el movimiento quedan consistentes, delta cero y motivo vacío responden `400` con su mensaje, el `PATCH` directo de `stock` responde `403` y el de `price` sigue funcionando.
- El build solo muestra avisos `DEP0155` de dependencias de Node; no son errores de la aplicación.

## Próximo trabajo: X9.2

El proyecto ya tiene 17 flujos E2E, pero cada uno prueba una vista. El plan pide
además dos que hoy no existen:

- Un **recorrido completo encadenado**: registro → crear negocio → venta →
  cotización a fiado → abono total → recibir compra → navegar a un mes anterior.
  Sobre un negocio recién creado, no sobre el demo, para que no dependa del seed.
- Un **test de aislamiento entre dos negocios del mismo usuario**: lo que se
  registra en uno no puede verse desde el otro. `business-switcher` ya roza esto
  con el Inventario; aquí toca cubrir venta, fiado, gasto y cotización.

Después quedan **X9.3 · Despliegue** y **X9.4 · Observabilidad**, y las dos
necesitan hablarse antes: la primera sale del entorno local y exige credenciales
del usuario; la segunda añade una dependencia nueva (Sentry o similar).

Pendiente transversal: `void_sale` sigue sin interfaz. Anular una venta no
aparece en ninguna tarea del plan; decidir con el usuario si se añade o se deja
fuera antes de cerrar la Fase 9.

## Nota de operación

Si una prueba E2E se interrumpe a mitad puede dejar una venta a crédito del
negocio demo ya abonada; a partir de ahí la limpieza de cualquier otra prueba
falla con «La operación dejaría la deuda del cliente en negativo», porque el
disparador impide borrar la venta sin borrar antes el abono. La salida es
`npm run db:reset`.

## Fuentes de diseño disponibles

- `Prototipo Interactivo.dc.html` — comportamiento, jerarquía, tabla/tarjetas y modales.
- `Mockups Inventario y Ganancias.dc.html` — composición visual, barras de distribución y tratamiento de estados recurrentes.

Ambos archivos están versionados desde F4.1 y son la fuente visual del `PLAN.md`. Consultarlos antes de tomar decisiones visuales en las siguientes vistas.
