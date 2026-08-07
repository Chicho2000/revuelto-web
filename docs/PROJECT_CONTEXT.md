# Contexto técnico de Revuelto

Actualizado: 2026-08-04. Este documento contiene estado comprobado y decisiones; `AGENTS.md` conserva las reglas obligatorias.

Guía operativa ampliada: [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md).

## Estado actual

- Stack activo: Next.js 16 App Router, React 19, TypeScript estricto, Tailwind, Prisma 7/PostgreSQL en Supabase, Supabase Auth/Storage, Zod, Sharp, ESLint y Vercel.
- Funciona la página pública `/`, cuyo menú y secciones de carta, promociones, sucursales y galería aparecen solo cuando tienen contenido público válido. También funcionan el login `/admin/login` y el panel protegido `/admin`. `/admin/bowls`, `/admin/branches`, `/admin/promotions` y `/admin/content` tienen administración OWNER; contenido general usa un singleton estructurado y galería admite fotos o miniaturas enlazadas a Instagram, sin subir ni reproducir videos.
- Integraciones activas: Prisma en servidor, Supabase Auth, protección de rutas, rate limiting persistente, Turnstile obligatorio e infraestructura de imágenes de staging. No hay datos mock como fallback.
- Rutas de infraestructura: login/logout/actividad, intención-completado-descarte de imágenes y handlers protegidos bajo `/admin/bowls/manage`, `/admin/branches/manage` y `/admin/promotions/manage`. Promociones admite crear, editar y cambiar estado; no admite borrado.
- Migraciones aplicadas, verificadas el 2026-08-03 mediante consulta de solo lectura a `_prisma_migrations`: `20260801000000_init`, `20260801000100_enable_row_level_security` y `20260801000200_admin_security_and_temporary_images`. Esta última activa RLS sin políticas para las tres tablas sensibles. No se reescriben migraciones aplicadas.
- `20260801000300_add_admin_session_absolute_expiry` es la nueva migración pendiente: añade el vencimiento absoluto de una hora a sesiones administrativas y conserva las sesiones existentes calculándolo desde `createdAt`. Se redactó offline como SQL aditivo; no se ejecutó `migrate dev`, `migrate deploy`, `db push`, reset ni ninguna conexión de escritura a Supabase.
- `20260804000100_add_promotion_weekly_schedule` también está pendiente y debe ejecutarse después de la anterior: agrega a `Promotion` días recurrentes y una franja horaria diaria opcional, con valores compatibles para las filas existentes y restricciones `CHECK` de par, formato y orden de horas. Fue redactada manualmente a partir del cambio validado en `schema.prisma`; no se aplicó ni se modificó el historial existente.
- `20260804000200_add_site_content_and_gallery` está pendiente y debe ejecutarse después de las anteriores: amplía aditivamente `SiteContent`, crea el singleton `site-config`, agrega `GalleryItem`/`GalleryItemType`, habilita RLS sin políticas y agrega `GALLERY` a `TemporaryImageTarget`. Conserva las filas editoriales legacy y copia `hero`/`about` al singleton cuando existen. No fue aplicada.
- Buckets: `revuelto-temp` privado y `bucket-media` público existen y se verificaron mediante Storage el 2026-08-03. `bucket-media` contiene las imágenes finales públicas; la aplicación no crea buckets.
- Pendiente: aplicar las migraciones autorizadas y configurar el cron de limpieza. Los formularios complejos usan React Hook Form y Zod.

Variables por nombre: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SECURITY_HMAC_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`.

`DATABASE_URL` debe usar Supavisor Transaction Pooler (6543) con `pgbouncer=true` y `connection_limit=1` para runtime serverless con PrismaPg. `DIRECT_URL` usa Supavisor Session Pooler (5432) para Prisma CLI y migraciones; ambos usan el usuario `postgres.[PROJECT-REF]` y el host regional que entrega Supabase Connect.

## Arquitectura y seguridad

Next.js entrega interfaz y Route Handlers; no existe Express. Prisma se usa exclusivamente desde módulos `server-only`. Supabase Auth identifica usuarios; Prisma lee `AdminUser` y exige `role = OWNER` e `isActive = true` en cada página, Route Handler o acción protegida. El proxy solo refresca/verifica la sesión y permite siempre `/admin/login`; no autoriza roles.

La carga pública consulta una sola vez cada conjunto en paralelo y produce `visibleBowls`, `visiblePromotions`, `visibleBranches` y `visibleGallery`. `buildPublicNavigation` deriva `hasBowls`, `hasPromotions`, `hasBranches`, `hasGallery`, `menuItems` y `sectionIds` desde esas mismas colecciones. `app/page.tsx` usa esos booleanos tanto para el menú como para renderizar las secciones; por eso no existen enlaces, títulos, contenedores ni anclas para colecciones vacías. Un video de galería solo es público si está activo, tiene imagen y conserva una URL HTTPS válida de una publicación/Reel oficial de Instagram. Las promociones son públicas si y solo si están activas; su programación semanal es informativa.

El login llega temporalmente al Route Handler y se envía directamente a Supabase Auth; contraseñas no se registran, guardan ni hashean en la aplicación. Tras Auth, una cuenta sin OWNER activo se cierra de inmediato y recibe una respuesta genérica. Los usuarios de Supabase Auth no se crean, editan, eliminan ni prueban automáticamente por la aplicación.

La sesión administrativa usa una cookie aleatoria propia, HTTP-only, SameSite=Lax, `Path=/admin` y Secure en producción. `AdminSessionActivity` almacena solo su HMAC, propietario, última actividad, vencimiento inactivo y vencimiento absoluto; no contiene tokens, JWT, refresh tokens, cookies ni contraseñas. Eventos de interacción real reinician el timer cliente y sincronizan al servidor como máximo una vez por minuto. La sesión cierra a los 30 minutos sin actividad o una hora desde el login, lo que ocurra primero; el servidor también rechaza ambos vencimientos.

`LoginAttempt` conserva HMAC de IP y email normalizado (trim/lowercase). Turnstile se exige desde el primer envío y se resetea tras cada respuesta fallida, porque sus tokens son de un solo uso. Cinco fallos de credenciales o autorización en 15 minutos bloquean 15 minutos. Éxito elimina el contador; fallos de Turnstile, infraestructura, timeout o base no lo incrementan. Turnstile se valida siempre por Siteverify, action `admin-login` y hostname configurado; token vencido/reutilizado no sirve.

La service role se lee exclusivamente en `lib/supabase/storage-admin.ts`, que es `server-only`, para URLs firmadas, copiar y borrar Storage. Nunca se usa para login, cookies, Auth, `AdminUser`, Prisma ni autorización y nunca llega al navegador. Claves públicas: URL/Publishable Key de Supabase y la Site Key entregada por Server Component. Claves privadas: URLs de base, service role, HMAC y Secret Key de Turnstile.

## Flujo de imágenes

1. Un OWNER con sesión administrativa solicita intención para BOWL, PROMOTION, BRANCH o GALLERY. El navegador no elige bucket, owner, prefijo, nombre ni destino final.
2. El servidor crea `TemporaryImage` y una URL firmada para un único `staging/{ownerId}/{uuid}` del bucket privado `revuelto-temp`. La intención se acepta durante diez minutos; no se procesa staging expirado.
3. El browser recibe el original por selección o arrastre y lo sube directamente a staging para admitir hasta 10 MB sin atravesar una Function de Vercel.
4. El servidor descarga y valida peso real, JPEG/PNG/WebP real, decodificación y un solo frame/página. Para bowls el límite es 5 MB, 6000×6000 y 24 MP. SVG, GIF, TIFF, BMP, HEIC, PDF y animados son rechazados.
5. Sharp autorrota, elimina metadatos y convierte sin ampliar a WebP calidad 82 con `fit: inside`: bowls 1600x1600, promociones 1920x1080, sucursales 1920x1440. Se guarda `temp/{ownerId}/{uuid}.webp` en el bucket privado.
6. El CRUD de bowls prepara la copia final, ejecuta Bowl + ambos tamaños mediante un nested write atómico, confirma el temporal y recién después borra la imagen anterior. Si falla la base, revierte la copia nueva sin tocar la anterior.
7. Promociones reutiliza el mismo workflow compensado: finales en `promotions/{promotionId}/{uuid}.webp`; al reemplazar conserva la anterior hasta confirmar la nueva y al quitar actualiza primero PostgreSQL. La salida es WebP 1920×1080 máximo, calidad 82, sin ampliar.
8. Galería reutiliza el workflow compensado: finales en `gallery/{galleryItemId}/{uuid}.webp`, máximo 1600×1200, calidad 82 y sin ampliar. El reemplazo actualiza primero la base y solo después elimina la imagen anterior.
9. Al fallar una limpieza, el registro queda `CLEANUP_PENDING`. La utilidad de limpieza debe ejecutarse por Vercel Cron o Supabase Cron, todavía no configurado.

La URL firmada se limita al objeto generado por servidor. Su duración efectiva depende de Supabase; además del vencimiento de proveedor, la aplicación limita la intención a diez minutos y no procesa objetos expirados.

## Decisiones técnicas

| Fecha | Decisión | Motivo y consecuencia | Archivos |
| --- | --- | --- | --- |
| 2026-08-01 | No usar Express | App Router conserva una sola aplicación; handlers sustituyen backend separado. | `app/**/route.ts` |
| 2026-08-01 | Prisma solo servidor | Evita credenciales cliente y mantiene autorización central. | `lib/prisma.ts`, `lib/auth.ts` |
| 2026-08-01 | Dos buckets y staging | Separa originales no confiables de finales públicos; se descartó mezclar ambos. | `lib/images/temporary-images.ts` |
| 2026-08-03 | Reutilizar `bucket-media` como bucket final | El bucket público ya existía y era visible para la service role; se evita duplicar buckets por una diferencia de nombre. | `lib/supabase/storage-admin.ts`, `docs/*` |
| 2026-08-01 | Service role solo Storage | Permite operar sin políticas de escritura para anon/authenticated; se descartó privilegio en browser. | `lib/supabase/storage-admin.ts` |
| 2026-08-01 | Login en Route Handler | Rate limit durable y borrado del contador al éxito; se descartó login cliente directo. | `app/api/admin/login/route.ts` |
| 2026-08-01 | HMAC para identificadores | Correlación durable sin email, IP o cookie en claro. | `lib/security/*` |
| 2026-08-03 | Turnstile obligatorio y sesión con doble límite | Evita intentos automatizados desde el primer envío y limita cada sesión a 30 min inactiva o 1 h absoluta. | `app/api/admin/login/route.ts`, `lib/security/admin-session.ts` |
| 2026-08-03 | CRUD de bowls con dos tamaños y reemplazo compensado | Zod exige SMALL/LARGE y Prisma los escribe mediante nested writes atómicos, más compatibles con Supavisor que transacciones interactivas; Storage se coordina con prepare/confirm/rollback. | `lib/bowls/*`, `lib/images/temporary-images.ts` |
| 2026-08-04 | CRUD de sucursales sobre el esquema existente | `BusinessHour` representa el horario, `isClosed` es la inversa de `isOpen` y `whatsappNumber` conserva el teléfono opcional. Nuevas filas inicializan `mapsUrl` vacío; ediciones preservan el valor legado. Zod y nested writes garantizan siete días. | `lib/branches/*`, `app/admin/**/branches/*` |
| 2026-08-04 | Borrado definitivo con confirmación por nombre | Evita eliminaciones accidentales. La interfaz exige el nombre exacto y el servicio lo compara de nuevo antes del `DELETE`; se descartó confiar solo en el botón deshabilitado del navegador. `BowlSize` y `BusinessHour` se eliminan por cascada. | `components/admin/delete-entity-button.tsx`, `lib/{bowls,branches}/*`, `app/admin/**/manage/[id]/route.ts` |
| 2026-08-04 | Menú público derivado del contenido visible | Una carga produce colecciones visibles y un único contrato de navegación/secciones. Se descartaron enlaces estáticos y ocultamiento por CSS porque podían apuntar a anclas inexistentes. | `lib/public-data.ts`, `lib/public-visibility.ts`, `app/page.tsx` |
| 2026-08-04 | CRUD de promociones con horario semanal | Se reutiliza staging y un workflow compensado compartido; se descartó duplicar la coordinación Storage/base. El alta y la edición usan solo días y horario de Argentina; las fechas históricas se ignoran para no modificar ni borrar datos existentes. | `lib/promotions/*`, `components/admin/promotions/*`, `app/admin/**/promotions/*` |
| 2026-08-04 | Programación semanal informativa de promociones | Los días sin horas representan días completos; las horas sin días se aplican todos los días; ambos vacíos informan disponibilidad todos los días. La promoción no se oculta fuera de la franja: solo `isActive` determina su visibilidad pública. Se descartaron rangos nocturnos cruzando medianoche para mantener reglas y restricciones inequívocas. | `prisma/schema.prisma`, `prisma/migrations/20260804000100_add_promotion_weekly_schedule`, `lib/promotions/schema.ts`, `lib/public-visibility.ts`, `app/page.tsx` |
| 2026-08-04 | Generar Prisma antes de desarrollo y build | Evita que un proceso nuevo use tipos de cliente anteriores tras un cambio de esquema. El proceso ya iniciado debe reiniciarse una vez; se descartó aplicar migraciones automáticamente. | `package.json`, `lib/promotions/schema.ts` |
| 2026-08-04 | Contenido singleton y galería enlazada | La clave única reservada `site-config` identifica la única fila activa de contenido sin eliminar las filas legacy. La galería guarda imágenes procesadas y, para videos, solo miniatura más enlace HTTPS oficial de Instagram. | `prisma/schema.prisma`, `lib/content/*`, `lib/gallery/*`, `app/admin/**/content/*` |
| 2026-08-07 | Carrusel de galería | Con cuatro o más elementos públicos, la galería rota cada cinco segundos y conserva controles accesibles; hasta tres se usa grilla. Cada alta o edición se persiste únicamente con el botón Guardar de su propio formulario. | `components/admin/gallery/gallery-item-form.tsx`, `components/public/gallery-display.tsx`, `lib/gallery/carousel.ts` |
| 2026-08-01 | No gestionar Auth users | Protege las cuentas creadas manualmente y separa identidad/autorización. | `lib/auth.ts` |

## Base de datos

- `AdminUser`: autorización para un UUID de Supabase Auth.
- `Bowl`, `BowlSize`: receta fija y sus tamaños SMALL/LARGE. Al borrar un bowl, sus tamaños se eliminan por cascada.
- `Branch`, `BusinessHour`: sucursal y un horario por día. El índice único `(branchId, dayOfWeek)` evita duplicados; las operaciones escriben los siete días y guardan días cerrados con `isClosed = true` y horas nulas. Al borrar una sucursal, sus horarios se eliminan por cascada.
- `Promotion`: promoción y programación semanal recurrente opcional mediante días y una franja horaria de Argentina. Conserva columnas de fechas históricas, que no usa el producto actualmente.
- `SiteContent`: conserva filas editoriales legacy y usa `key = site-config` como singleton estructurado de textos, contacto, footer y SEO.
- `GalleryItem`: imagen o miniatura de Instagram, enlace externo validado, orden y estado.
- `LoginAttempt`: rate limit por hashes, sin datos personales en claro.
- `AdminSessionActivity`: HMAC de cookie administrativa, vencimiento inactivo y máximo absoluto de una hora.
- `TemporaryImage`: staging, temporal, estado, propietario y metadatos procesados.

## Operaciones manuales y pruebas

1. Crear las variables anteriores sin versionar valores; generar `SECURITY_HMAC_SECRET` aleatorio de 32+ caracteres.
2. Mantener `revuelto-temp` privado y `bucket-media` público. No conceder insert/update/delete a anon o authenticated; la lectura pública queda solo para finales.
3. En Cloudflare Turnstile crear el widget, permitir hostnames local/producción, usar action `admin-login` y configurar las tres variables de Turnstile. La Secret Key no sale del servidor.
4. Revisar y, solo cuando sea autorizado, aplicar en orden `20260801000300_add_admin_session_absolute_expiry`, `20260804000100_add_promotion_weekly_schedule` y `20260804000200_add_site_content_and_gallery`. Las tres migraciones iniciales ya figuran aplicadas.
5. Configurar secretos en Vercel y un cron autenticado que llame la limpieza de temporales. No hay cron automático aún.
6. Probar manualmente el CRUD de bowls: alta con dos precios, slug duplicado, edición, estado, selección, arrastre, cambio y cancelación de imagen, y límites 5 MB/6000×6000/24 MP. Para borrar, cancelar primero, luego intentar con un nombre distinto y finalmente escribir exactamente el nombre; verificar que sus tamaños desaparezcan.
7. Probar el CRUD de sucursales: alta/edición, siete días, abiertos/cerrados, validación de horas, teléfono opcional, activación/desactivación y visibilidad pública. Para borrar, repetir la confirmación exacta y verificar que sus horarios desaparezcan. Mantener además las pruebas manuales de login y sesión. Nunca cambiar ni probar automáticamente contraseñas reales.
8. Probar la navegación pública en escritorio y celular alternando contenido activo/inactivo: cada enlace Carta, Promociones o Sucursales debe aparecer junto con su sección y desaparecer con ella.
9. Probar promociones: desactivar la demo actual y comprobar que desaparezcan menú/sección; crear y editar una promoción; activar/desactivar; cargar, reemplazar, quitar y cancelar imagen. Una promoción activa debe mostrarse aun fuera de su franja, junto con el texto de días y horario; una inactiva no debe mostrar tarjeta, menú ni sección. Probar días completos sin horas y horario diario sin días. Los rangos que cruzan medianoche deben rechazarse. Tras un cambio de esquema, detener y volver a iniciar el servidor; `npm run dev` ejecuta `prisma generate` antes de iniciar Next. El seed quedó configurado para futuras ejecuciones con la demo inactiva, pero no se ejecutó ni se alteró la fila actual.

Pruebas realizadas el 2026-08-07: `npx prisma generate`, `npx prisma validate`, `npm test`, `npm run lint`, `npm run build` y `git diff --check`. La suite suma 73 pruebas, incluidas validaciones de contenido, galería y carrusel. No se usaron contraseñas ni se modificaron cuentas.

Verificación local adicional del 2026-08-04: `GET http://localhost:3000/` respondió 200 y el HTML real contenía `#inicio`, `#carta`, `#promociones` y `#sucursales`, todos con un `section id` correspondiente y ningún destino faltante para los datos actuales. El control visual integrado del navegador no pudo conectarse por un fallo de su entorno; la inspección visual responsive en navegador queda como prueba manual, aunque el menú usa flex wrapping y una disposición específica bajo 560 px.

## Pendientes

- Configurar cron de limpieza.
- Implementar CRUD de contenido.
- Revisar y aplicar las dos migraciones pendientes antes de probar en base real la expiración absoluta y la programación semanal.
- Añadir integración contra un entorno de prueba aislado, nunca cuentas o datos reales.
