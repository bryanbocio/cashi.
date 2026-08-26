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

Copia en `.env` el valor de `API URL` como `SUPABASE_URL` y el valor de
`anon key` como `SUPABASE_ANON_KEY`.

## Reiniciar la base local

Con Docker Desktop y Supabase local en ejecución:

```powershell
npm run db:reset
```

El comando reconstruye la base desde las migraciones versionadas y ejecuta
`supabase/seed.sql`. En S0.1 el seed está vacío; el esquema y los datos de prueba
se incorporarán en S0.2.

## Comandos útiles

```powershell
npm run supabase:start
npm run supabase:status
npm run db:reset
npm run db:test
npm run supabase:stop
```

Supabase Studio queda disponible por defecto en `http://127.0.0.1:54323`.
