# Contexto de trabajo — Cashi

Actualizado: 26 de agosto de 2026, después de completar F1.2.

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

La siguiente tarea del `PLAN.md` es **F1.3 · Onboarding "Crear negocio"**.

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
- La sidebar ya muestra el nombre, las iniciales y el rol del negocio activo; el selector completo corresponde a F1.4.
- El seed local incluye `onboarding@cashi.local` sin negocio y `other@cashi.local` con un tenant ajeno para las pruebas automatizadas. Las credenciales están documentadas junto a esos fixtures en `supabase/seed.sql`.

## Última validación

Todo pasó después de F1.1:

- `npm run app:typecheck`.
- `npm run app:build`.
- `npm --prefix app run smoke`: 14 rutas, cajón móvil y ausencia de errores de consola/hidratación.
- `npm run app:test:auth`: flujo completo real contra Supabase local y Mailpit.
- `npm run app:test:session-business`: redirección anónima, onboarding sin membresías, persistencia del negocio y rechazo RLS de un tenant ajeno.
- `npm run db:test`: 36 pruebas SQL y 100 códigos concurrentes únicos.
- El build solo muestra avisos `DEP0155` de dependencias de Node; no son errores de la aplicación.

## Próximo trabajo: F1.3

Implementar:

1. Sustituir el placeholder de `/onboarding` por el formulario de nombre, moneda y zona horaria.
2. Validar el formulario y llamar a `create_business(p_name, p_currency, p_timezone)`.
3. Recargar las membresías, activar el UUID devuelto y entrar al Resumen.
4. Conservar el aviso de seguridad cuando F1.2 detecta un UUID manipulado.
5. Probar que el negocio, la membresía OWNER, las categorías base y las secuencias quedan disponibles para el usuario nuevo.

## Diseño pendiente

El `PLAN.md` menciona `Prototipo Interactivo.dc.html` y `Mockups Inventario y Ganancias.dc.html`, pero esos archivos no están presentes actualmente en el repositorio. La UI base y F1.1 se construyeron con los tokens descritos en el plan. Antes de decisiones visuales importantes, pedir esos archivos al usuario.
