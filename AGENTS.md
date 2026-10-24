# Proyecto Revuelto

## Objetivo

Desarrollar la página pública y el panel administrativo de Revuelto, un
negocio de revueltos de huevos orientado principalmente a personas que
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

- La nueva carta acordada está en `docs/NEW_MENU_SPEC.md`. Distinguirla del
  modelo `Bowl`/`BowlSize` todavía implementado hasta completar la migración.
- De cara al cliente los productos se llaman **Revueltos**. Habrá seis recetas
  definidas y un único producto personalizable, **Tu Revuelto**.
- Los Revueltos definidos no admiten agregados ni toppings. El cliente solo
  puede quitar ingredientes que el administrador marque como removibles.
- **Buenos días, buenas tardes** exige elegir exactamente una opción entre
  jamón y panceta, además de las posibles exclusiones de su receta fija.
- **Tu Revuelto** permite elegir ingredientes con los límites de la
  especificación; los huevos revueltos son una base obligatoria e inamovible.
- La nueva carta tiene un solo tamaño. El recipiente es de 20 oz; no usar
  `SMALL`, `LARGE`, 25 oz ni 35 oz en la nueva experiencia.
- Los precios y las fotos finales todavía no están definidos. No inventarlos.

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

El usuario ejecuta personalmente los comandos de Git que modifiquen el índice,
las ramas, el historial o el remoto. Describirle los comandos y su efecto; no
ejecutar `git add`, `commit`, `merge`, `rebase`, `reset` ni `push` por él.

Al terminar una implementación que cambie arquitectura, seguridad, base de
datos, variables, rutas o flujos, actualizar `docs/PROJECT_CONTEXT.md`.
