# Proyecto Revuelto

## Objetivo

Desarrollar la página pública y el panel administrativo de Revuelto, un
negocio de bowls de huevos revueltos orientado principalmente a personas que
salen del gimnasio.

## Stack obligatorio

- Next.js con App Router.
- React.
- TypeScript estricto.
- Tailwind CSS.
- Prisma ORM.
- PostgreSQL alojado en Supabase.
- Supabase Auth.
- Supabase Storage.
- Zod.
- React Hook Form para formularios administrativos complejos.
- ESLint.
- npm.
- Vercel para despliegue.

## Arquitectura

- No crear un backend Express separado.
- Prisma debe ejecutarse exclusivamente en el servidor.
- No importar Prisma Client en Client Components.
- Usar Server Components por defecto.
- Usar Client Components solo cuando se necesite interacción.
- No exponer credenciales ni claves privadas al navegador.
- No crear registro público.
- La página pública no requiere autenticación.
- Todas las rutas administrativas deben comprobar autenticación y autorización.
- No usar datos simulados permanentes una vez conectada la base.

## Productos

- No existen toppings seleccionables.
- Cada bowl es una receta fija.
- Cada bowl debe tener exactamente dos tamaños:
  - SMALL: 25 oz.
  - LARGE: 35 oz.
- Cada tamaño puede tener precio, cantidad de huevos, notas de cantidades y
  disponibilidad diferentes.

## Identidad visual

Antes de modificar la interfaz, leer completamente:

- `brand-assets/README.md`
- `brand-assets/original/`
- `public/brand/logos/`
- `src/assets/fonts/`

No inventar:

- Colores.
- Logos.
- Íconos.
- Tipografías.
- Fotografías de productos.
- Estilos visuales ajenos a la marca.

No modificar internamente los SVG originales.

## Seguridad

- No confiar únicamente en la interfaz para proteger acciones.
- Verificar en el servidor que el usuario sea administrador.
- No habilitar registro público.
- No utilizar credenciales de base de datos en componentes cliente.
- No subir `.env`, `.env.local` ni secretos a Git.
- No ejecutar migraciones destructivas sin autorización.
- No resetear la base sin autorización.

## Forma de trabajo

Antes de implementar una tarea importante:

1. Inspeccionar el repositorio.
2. Leer `docs/PROJECT_CONTEXT.md`.
3. Explicar el plan.
4. Enumerar paquetes nuevos.
5. Enumerar archivos a modificar.
6. Esperar aprobación cuando la tarea lo solicite.

Antes de terminar:

1. Ejecutar `npm run lint`.
2. Ejecutar `npm run build`.
3. Revisar errores de TypeScript.
4. Ejecutar las validaciones disponibles de Prisma.
5. Informar archivos modificados.
6. Informar decisiones y supuestos.
7. No hacer push automáticamente.

Al terminar una implementación que cambie arquitectura, seguridad, base de
datos, variables, rutas o flujos, actualizar `docs/PROJECT_CONTEXT.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
