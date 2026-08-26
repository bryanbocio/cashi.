# Contexto de trabajo — Cashi

Actualizado: 26 de agosto de 2026, después de completar S2.2.

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

La siguiente tarea del `PLAN.md` es **F2.1 · Vista Inventario**. S2.3 (import CSV) sigue pendiente y solo bloquea F2.2.

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
npm run app:test:onboarding
npm run app:test:settings
npm run app:test:session-business
npm run db:test
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
- `app/app/stores/business.ts` conserva `cashi.active-business-id` en `localStorage`, valida el UUID mediante una consulta protegida por RLS y expone el negocio/membresía activos.
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
- El seed local incluye `onboarding@cashi.local` sin negocio y `other@cashi.local` con un tenant ajeno para las pruebas automatizadas. Las credenciales están documentadas junto a esos fixtures en `supabase/seed.sql`.

## Última validación

Validaciones vigentes al completar S2.2:

- `npm run app:typecheck`.
- `npm run app:build`.
- `npm --prefix app run smoke`: 14 rutas, cajón móvil y ausencia de errores de consola/hidratación.
- `npm run app:test:auth`: flujo completo real contra Supabase local y Mailpit.
- `npm run app:test:business-switcher`: dos negocios, cambio desde Inventario al Resumen, contexto visible actualizado, versión móvil y cierre de sesión.
- `npm run app:test:onboarding`: registro, confirmación, login, creación y activación del negocio; comprobación de `OWNER`, categorías y secuencias en PostgreSQL.
- `npm run app:test:settings`: negocio, logo privado, cuenta, contraseña y nuevo login completos desde la interfaz.
- `npm run app:test:session-business`: redirección anónima, onboarding sin membresías, persistencia del negocio y rechazo RLS de un tenant ajeno.
- `npm run db:test`: 116 pruebas SQL (53 iniciales + 39 de `product_stats` + 24 de `adjust_stock`) y 100 códigos concurrentes únicos.
- `supabase db lint`: «No schema errors found».
- Comprobación real sobre PostgREST con el usuario `demo@cashi.local`: cada filtro de `v_product_stats` devuelve lo esperado, `other@cashi.local` no ve nada del negocio demo y el acceso anónimo responde `401 permission denied for view v_product_stats`.
- Comprobación real de `adjust_stock` sobre PostgREST: el ajuste devuelve el nuevo stock, la vista y el movimiento quedan consistentes, delta cero y motivo vacío responden `400` con su mensaje, el `PATCH` directo de `stock` responde `403` y el de `price` sigue funcionando.
- El build solo muestra avisos `DEP0155` de dependencias de Node; no son errores de la aplicación.

## Próximo trabajo: F2.1

Implementar la vista Inventario sobre `v_product_stats`:

1. Tabla en escritorio y tarjetas en móvil, reutilizando `ui/DataTable.vue` y `ui/CardList.vue`.
2. Buscador y filtros Todos / Stock bajo / Margen bajo con las consultas PostgREST ya documentadas.
3. Panel lateral de edición con costo, precio y mínimo por `update` directo, y el stock **solo** por `adjust_stock` con su motivo; margen y valor calculados en vivo.
4. Destacar la fila de stock bajo con su aviso.

Notas para la implementación:

- Los tipos generados declaran todas las columnas de la vista como opcionales (`| null`), porque Postgres no infiere `not null` en vistas. La UI debe manejarlo en vez de forzar el tipo.
- El cálculo en vivo del panel es la única excepción permitida al «la regla vive en Postgres»: es un estimado antes de guardar, igual que el del carrito.

## Diseño pendiente

El `PLAN.md` menciona `Prototipo Interactivo.dc.html` y `Mockups Inventario y Ganancias.dc.html`, pero esos archivos no están presentes actualmente en el repositorio. La UI base y F1.1 se construyeron con los tokens descritos en el plan. Antes de decisiones visuales importantes, pedir esos archivos al usuario.
