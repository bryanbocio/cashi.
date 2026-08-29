# Despliegue (X9.3)

Guía para poner Cashi en producción: Supabase para la base, las funciones y el
almacenamiento; Vercel para el frontend; GitHub Actions para las migraciones.

Repositorio: `git@github.com:bryanbocio/cashi..git` (rama `master`).

## 1. Credenciales

| Qué | Para qué | Dónde se guarda |
| --- | --- | --- |
| Contraseña de la base | `db push` y el CI | Gestor de contraseñas + secreto `SUPABASE_DB_PASSWORD` |
| Project ref | Identificar el proyecto | Secreto `SUPABASE_PROJECT_REF` |
| Personal access token | Que el CI publique | Secreto `SUPABASE_ACCESS_TOKEN` |
| Publishable key (anon) | La usa el navegador | Variable `NUXT_PUBLIC_SUPABASE_KEY` en Vercel |
| URL del proyecto | La usa el navegador | Variable `NUXT_PUBLIC_SUPABASE_URL` en Vercel |
| SMTP (host, puerto, usuario, contraseña, remitente) | Correos de registro y recuperación | Panel de Supabase → Auth |

Dos reglas que no se negocian:

- **La `service_role` / secret key no se usa en este proyecto.** No va al
  frontend, ni a Vercel, ni al CI. Las dos Edge Functions trabajan con la sesión
  de quien llama para que la RLS siga mandando.
- **La publishable key es pública por diseño**: viaja en el navegador. Lo que
  protege los datos es la RLS.

## 2. Proyecto Supabase

1. Crear el proyecto y **guardar la contraseña de la base**: no se puede volver
   a ver.
2. Región cercana a los usuarios.
3. Los backups diarios que pide el `PLAN.md` son de plan de pago; el gratuito
   además pausa proyectos inactivos. Conviene confirmar el precio vigente antes
   de comprometer una tienda real.

## 3. Primer despliegue desde tu máquina

```powershell
npx supabase login                       # abre el navegador
npx supabase link --project-ref TU_REF   # pide la contraseña de la base
npx supabase db push                     # 24 migraciones
npx supabase functions deploy            # import-products y document-pdf
```

`db push` **no ejecuta `supabase/seed.sql`** —eso solo pasa con `db reset`—, así
que producción arranca sin datos de demostración. El bucket privado `logos` sí
se crea, porque vive en una migración.

Las Edge Functions no necesitan secretos: Supabase les inyecta `SUPABASE_URL` y
`SUPABASE_ANON_KEY`. Las tipografías del PDF viajan como base64 dentro del
código, así que no dependen de archivos sueltos en el despliegue.

## 4. Auth en el panel de Supabase

`supabase/config.toml` es **solo para el entorno local**; estos valores hay que
ponerlos en el panel:

- **Site URL**: el dominio de Vercel.
- **Redirect URLs**: `https://TU_DOMINIO/**`.
- **SMTP propio**: el registro exige confirmar el correo
  (`enable_confirmations = true`). Sin SMTP propio se usa el emisor de pruebas
  de Supabase, con un puñado de envíos por hora: nadie podría registrarse.

## 5. Vercel

- **Root directory**: `app`
- **Build command**: `npm run build:vercel`

  El script `build` normal apunta a `--dotenv ../.env`, que no existe en Vercel;
  `build:vercel` es el mismo build sin esa opción.
- **Variables de entorno**: `NUXT_PUBLIC_SUPABASE_URL` y
  `NUXT_PUBLIC_SUPABASE_KEY`.

Las vistas privadas están marcadas como `ssr: false` en `nuxt.config.ts`, así
que se renderizan en el navegador; login, registro y recuperación sí pasan por
el servidor. Vercel necesita el runtime de Node, que es lo que Nitro elige solo.

## 6. CI de migraciones

`.github/workflows/supabase.yml` aplica migraciones y publica funciones al
entrar algo en `master`. Necesita tres secretos en el repositorio
(*Settings → Secrets and variables → Actions*):

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

El workflow fija la versión del CLI a la misma que se usa en local, para que un
cambio de herramienta no se confunda con un fallo de migración.

## 7. Comprobación después de desplegar

Sobre el sitio ya publicado, con un correo real:

1. Registro → llega el correo → confirmar → iniciar sesión.
2. Crear el negocio en el onboarding.
3. Alta de un producto y una venta de contado.
4. Abrir la venta y **descargar el PDF**: comprueba de una vez la Edge Function,
   la tipografía embebida y la lectura del logo en el bucket privado.
5. Subir un logo en Ajustes y repetir el PDF.

## Pendiente

- **X9.4 · Observabilidad**: logs de Edge Functions, Sentry o similar en el
  frontend y una consulta guardada de errores de RPC. Sentry es una dependencia
  nueva y hay que revisar su licencia antes de añadirla.
