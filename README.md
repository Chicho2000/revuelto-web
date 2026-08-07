# Revuelto

Documentación técnica y operativa: [`docs/PROJECT_DOCUMENTATION.md`](./docs/PROJECT_DOCUMENTATION.md).

Carta pública y panel administrativo privado para Revuelto. Está construido con
Next.js App Router, TypeScript estricto, Tailwind CSS, Prisma, PostgreSQL en
Supabase y Supabase Auth/Storage.

## Requisitos

- Node.js 20.19 o superior.
- npm.
- Un proyecto de Supabase existente.

## Instalación local

1. Instalá dependencias:

   ```bash
   npm install
   ```

   El script `postinstall` ejecuta `prisma generate`, por lo que el cliente en
   `generated/prisma` se crea antes del build y no se versiona.

2. Copiá `.env.example` como `.env.local` y completá sus valores.

3. Iniciá la aplicación:

   ```bash
   npm run dev
   ```

Si faltan variables, la carta pública y el panel muestran un estado claro de
configuración. La aplicación no entrega datos simulados como fallback.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión pooled de Supabase/PostgreSQL usada por Prisma en runtime. |
| `DIRECT_URL` | Conexión directa usada exclusivamente por Prisma CLI y migraciones. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable Key actual de Supabase para Auth y Storage. |

Este proyecto usa la convención actual de Publishable Key. No mezcles ni
agregues `NEXT_PUBLIC_SUPABASE_ANON_KEY` para esta implementación. No se usa
ni se usa para Auth, cookies, Prisma ni autorización. La service role solo se
usa desde un módulo `server-only` para operaciones administrativas de Storage.

## Prisma y migraciones

La migración inicial está preparada en
`prisma/migrations/20260801000000_init/migration.sql` fue aplicada según el
estado informado del proyecto; no debe modificarse.

Se generó sin conexión a Supabase mediante:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

Ese comando compara el esquema con una base vacía y solo emite SQL local. No se
ejecutaron `migrate dev`, `migrate deploy`, `db push` ni resets.

Cuando las credenciales estén listas y exista autorización explícita para
aplicar la migración, validá primero y luego usá:

```bash
npm run prisma:validate
npx prisma migrate deploy
npm run prisma:seed
```

El seed es idempotente y carga contenido demostrativo, un bowl con tamaños
`SMALL` (25 oz) y `LARGE` (35 oz), una sucursal y una promoción. No crea
usuarios de Auth ni `AdminUser`.

## Configuración manual de Supabase

1. Obtené la URL del proyecto y la Publishable Key desde Supabase.
2. Obtené la conexión pooled para `DATABASE_URL` y la directa para `DIRECT_URL`.
3. Creá manualmente las dos cuentas de los dueños en Supabase Auth. No habilites
   registro público.
4. Tras aplicar la migración, insertá para cada dueño un registro `AdminUser`
   con el UUID de Auth en `authUserId`, `role = 'OWNER'` e `isActive = true`.
5. Para imágenes futuras, creá y configurá un bucket público de Storage. Las
   URLs públicas de Storage ya están permitidas en la configuración de imágenes.

El `proxy.ts` en la raíz solo refresca la sesión y redirige rápidamente. Cada
página administrativa vuelve a validar en servidor el usuario de Supabase y su
registro activo `AdminUser` con rol `OWNER`. Las futuras Server Actions y Route
Handlers administrativos deben usar `requireOwner` de `lib/auth.ts`.

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción. |
| `npm run lint` | ESLint. |
| `npm run prisma:generate` | Genera Prisma Client. |
| `npm run prisma:validate` | Valida el esquema de Prisma. |
| `npm run prisma:seed` | Ejecuta el seed, solo con `DATABASE_URL`. |

## Estado actual

Incluye base de datos, Auth, seguridad del panel, carta pública, identidad
visual, infraestructura de imágenes, CRUD completo de bowls con SMALL/LARGE y
CRUD de sucursales con siete horarios. Siguen pendientes los CRUD de
promociones y contenido.
