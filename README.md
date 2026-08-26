# Cashi

Aplicación de inventario y ganancias construida con Nuxt y Supabase. Consulta
[`PLAN.md`](./PLAN.md) para el alcance y el backlog del producto.

## Requisitos locales

- Node.js 20 o superior
- Docker Desktop en ejecución

Supabase CLI se instala como dependencia del proyecto; no hace falta instalarla
globalmente.

## Preparación

```powershell
npm install
Copy-Item .env.example .env
npm run supabase:start
npm run supabase:status
```

Copia en `.env` el valor de `API URL` como `NUXT_PUBLIC_SUPABASE_URL` y el valor
de `Publishable key` como `NUXT_PUBLIC_SUPABASE_KEY`.

## Aplicación web

El frontend usa Nuxt 4, Tailwind CSS 4, PrimeVue 4 (MIT), Pinia y el módulo oficial
de Supabase para Nuxt.

```powershell
npm run app:dev
npm run app:typecheck
npm run app:build
npm run app:test:auth
npm run app:test:inventory
npm run app:test:session-business
```

## Reiniciar la base local

Con Docker Desktop y Supabase local en ejecución:

```powershell
npm run db:reset
```

El comando reconstruye la base desde las migraciones versionadas y ejecuta
`supabase/seed.sql` con el negocio y los datos de demostración.

## Comandos útiles

```powershell
npm run supabase:start
npm run supabase:status
npm run db:reset
npm run db:types
npm run db:test
npm run supabase:stop
```

Supabase Studio queda disponible por defecto en `http://127.0.0.1:54323`.
Los correos locales de confirmación y recuperación se consultan en Mailpit:
`http://127.0.0.1:54324`.

Después de cambiar el esquema, regenera el cliente tipado con `npm run db:types`.
