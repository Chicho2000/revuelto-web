# Contexto técnico de Revuelto

Actualizado: 2026-08-22. Este documento contiene estado comprobado y decisiones; `AGENTS.md` conserva las reglas obligatorias.

Commit actual verificado: `6b5b0ab` (`feat: integra merchandising y rediseño público`). El sistema de pedidos descrito abajo está implementado como cambio local todavía sin commit ni push.

Guía operativa ampliada: [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md).

## Cambios desde el último push

- Se reforzó la protección servidor de los Route Handlers administrativos, con respuestas HTTP genéricas y coherentes, y se mantuvo el proxy limitado a navegación y refresco de sesión.
- El flujo de imágenes ahora conserva bytes, formato, resolución y metadata de JPEG, PNG y WebP tras validarlos; también incorpora límites uniformes, rate limit persistente e idempotencia de temporales.
- Se agregó el endpoint de limpieza protegido por `CRON_SECRET`, su programación diaria en Vercel y las instrucciones de políticas restrictivas para Storage. La prueba local autenticada del 2026-08-12 respondió 200 y limpió 9 temporales vencidos, sin errores ni recursos finales afectados.
- Se incorporó Sentry para servidor, edge y navegador con tracing desactivado y sanitización previa al envío; además hay límites de errores públicos para no revelar Prisma, SQL ni stack.
- Se actualizaron dependencias, variables de ejemplo, documentación y pruebas automatizadas para reflejar estos flujos.
- Se implementó un carrito público versionado para bowls y merchandising, checkout por sucursal, efectivo/transferencia y preparación segura de un mensaje de WhatsApp con precios recalculados en servidor.

## Estado actual

- Stack activo: Next.js 16 App Router, React 19, TypeScript estricto, Tailwind, Prisma 7/PostgreSQL en Supabase, Supabase Auth/Storage, Zod, Sharp, ESLint y Vercel.
- Funciona la página pública `/`, cuyo menú y secciones de carta, promociones, sucursales, galería y merchandising aparecen solo cuando tienen contenido público válido. Cuando `orderingEnabled` está activo, bowls y merchandising se agregan al carrito local, se elige una sucursal con WhatsApp válido y se prepara el pedido para efectivo o transferencia. También funcionan el login `/admin/login` y el panel protegido `/admin`; `/admin/content` permite configurar pedidos y medios de pago.
- Integraciones activas: Prisma en servidor, Supabase Auth, protección de rutas, rate limiting persistente, Turnstile obligatorio e infraestructura de imágenes de staging. No hay datos mock como fallback.
- Rutas de infraestructura: login/logout/actividad, intención-completado-descarte de imágenes y handlers protegidos bajo `/admin/bowls/manage`, `/admin/branches/manage`, `/admin/promotions/manage` y `/admin/merchandise/manage`. Promociones y merchandising admiten crear, editar y cambiar estado; no admiten borrado.
- Las siete migraciones hasta `20260819000100_add_merchandise` están aplicadas. `npx prisma migrate status` del 2026-08-22 encontró ocho migraciones y señaló únicamente `20260822000100_add_public_ordering` como no aplicada. Esta migración aditiva amplía `SiteContent` con cuatro flags y crea `PublicOrderRateLimit`. No se ejecutó `migrate deploy`, `migrate dev`, `db push` ni reset.
- Los buckets fueron corregidos y revisados manualmente: `revuelto-temp` es privado y `bucket-media` es público para lectura; ambos limitan archivos a 5 MB y aceptan JPEG, PNG y WebP. La aplicación conserva el formato original validado y no convierte automáticamente a WebP. La aplicación no crea ni reconfigura buckets.
- Sentry está configurado en `.env.local`, sanitizado y funcionando. La ruta temporal `/api/dev/test-sentry` usada para comprobar la integración fue eliminada.
- `CRON_SECRET` está configurado. La auditoría del cron quedó completada: el endpoint devuelve 401 sin secreto o con uno incorrecto, `vercel.json` fue validado y al auditar había 0 registros `TemporaryImage` candidatos a limpieza.
- Los formularios complejos usan React Hook Form y Zod.
- La home pública integra un rediseño visual selectivo: `PublicHeader` sticky con menú mobile accesible, `RevealController` progresivo y una hoja `app/public.css`. Mantiene la misma fuente de datos, navegación condicional y sección de Merchandising; ClickSpark y CurvedLoop se descartaron para no agregar interacción decorativa cliente.

Variables por nombre: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SECURITY_HMAC_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`, `CRON_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`.

`DATABASE_URL` debe usar Supavisor Transaction Pooler (6543) con `pgbouncer=true` y `connection_limit=1` para runtime serverless con PrismaPg. `DIRECT_URL` usa Supavisor Session Pooler (5432) para Prisma CLI y migraciones; ambos usan el usuario `postgres.[PROJECT-REF]` y el host regional que entrega Supabase Connect.

## Arquitectura y seguridad

Next.js entrega interfaz y Route Handlers; no existe Express. Prisma se usa exclusivamente desde módulos `server-only`. Supabase Auth identifica usuarios; Prisma lee `AdminUser` y exige `role = OWNER` e `isActive = true` en cada página, Route Handler o acción protegida. El proxy refresca/verifica la sesión, permite siempre `/admin/login`, redirige solo navegación privada y deja pasar los handlers sensibles para que respondan JSON 401/403 mediante su propia autorización; no decide roles.

La carga pública consulta una sola vez cada conjunto en paralelo y produce `visibleBowls`, `visiblePromotions`, `visibleBranches`, `visibleGallery` y `visibleMerchandise`. `buildPublicNavigation` deriva los cinco booleanos `has*`, `menuItems` y `sectionIds` desde esas mismas colecciones. `app/page.tsx` usa esos booleanos tanto para el menú como para renderizar las secciones; por eso no existen enlaces, títulos, contenedores ni anclas para colecciones vacías. Un producto de merchandising solo es público si está activo y tiene imagen. Un video de galería además exige una URL HTTPS oficial válida. Las promociones son públicas si y solo si están activas; su programación semanal es informativa.

El login llega temporalmente al Route Handler y se envía directamente a Supabase Auth; contraseñas no se registran, guardan ni hashean en la aplicación. Tras Auth, una cuenta sin OWNER activo se cierra de inmediato y recibe una respuesta genérica. Los usuarios de Supabase Auth no se crean, editan, eliminan ni prueban automáticamente por la aplicación.

La sesión administrativa usa una cookie aleatoria propia, HTTP-only, SameSite=Lax, `Path=/admin` y Secure en producción. `AdminSessionActivity` almacena solo su HMAC, propietario, última actividad, vencimiento inactivo y vencimiento absoluto; no contiene tokens, JWT, refresh tokens, cookies ni contraseñas. Eventos de interacción real reinician el timer cliente y sincronizan al servidor como máximo una vez por minuto. La sesión cierra a los 30 minutos sin actividad o una hora desde el login, lo que ocurra primero; el servidor también rechaza ambos vencimientos.

`LoginAttempt` conserva HMAC de IP y email normalizado (trim/lowercase). Turnstile se exige desde el primer envío y se resetea tras cada respuesta fallida, porque sus tokens son de un solo uso. Cinco fallos de credenciales o autorización en 15 minutos bloquean 15 minutos. Éxito elimina el contador; fallos de Turnstile, infraestructura, timeout o base no lo incrementan. Turnstile se valida siempre por Siteverify, action `admin-login` y hostname configurado; token vencido/reutilizado no sirve.

La service role se lee exclusivamente en `lib/supabase/storage-admin.ts`, que es `server-only`, para URLs firmadas, copiar y borrar Storage. Nunca se usa para login, cookies, Auth, `AdminUser`, Prisma ni autorización y nunca llega al navegador. Claves públicas: URL/Publishable Key de Supabase y la Site Key entregada por Server Component. Claves privadas: URLs de base, service role, HMAC y Secret Key de Turnstile.

El carrito vive en componentes cliente pequeños y persiste únicamente identificadores, tamaño y cantidades en `localStorage` bajo `revuelto-cart-v1`. `POST /api/orders/prepare` acepta un esquema Zod estricto, aplica un límite persistente de 20 preparaciones cada 10 minutos por HMAC de IP y vuelve a consultar Bowl, BowlSize, MerchandiseItem, Branch y SiteContent con Prisma. Nombres, precios, subtotales, total y WhatsApp nunca se aceptan como fuente confiable del navegador. El enlace abre el chat de la sucursal con texto precargado; el cliente todavía debe revisarlo y enviarlo, y puede modificarlo.

## Flujo de imágenes

1. Un OWNER con sesión administrativa solicita intención para BOWL, PROMOTION, BRANCH, GALLERY o MERCHANDISE. El navegador no elige bucket, owner, prefijo, nombre ni destino final.
2. El servidor crea `TemporaryImage` y una URL firmada para un único `staging/{ownerId}/{uuid}` del bucket privado `revuelto-temp`. La intención se acepta durante diez minutos; no se procesa staging expirado.
3. El browser recibe el original por selección o arrastre y lo sube directamente al staging indicado, sin elegir bucket, nombre ni ruta final.
4. El servidor descarga y valida peso real, JPEG/PNG/WebP real, 5 MB, 6000×6000, 24 MP y un solo frame/página para todos los destinos. SVG, GIF, TIFF, BMP, HEIC, PDF y animados son rechazados.
5. Sharp inspecciona formato, dimensiones y frames, pero no transforma. El servidor conserva exactamente los bytes y metadatos del JPEG, PNG o WebP aceptado y guarda `temp/{ownerId}/{uuid}.{jpg|png|webp}` con extensión y Content-Type derivados del formato real.
6. El CRUD de bowls prepara la copia final, ejecuta Bowl + ambos tamaños mediante un nested write atómico, confirma el temporal y recién después borra la imagen anterior. Si falla la base, revierte la copia nueva sin tocar la anterior.
7. Promociones reutiliza el mismo workflow compensado: finales en `promotions/{promotionId}/{uuid}.{ext}`; al reemplazar conserva la anterior hasta confirmar la nueva y al quitar actualiza primero PostgreSQL.
8. Galería reutiliza el workflow compensado: finales en `gallery/{galleryItemId}/{uuid}.{ext}`. El reemplazo actualiza primero la base y solo después elimina la imagen anterior.
9. Merchandising reutiliza el mismo workflow: finales en `merchandise/{merchandiseId}/{uuid}.{ext}`; reemplazo conserva la anterior hasta confirmar la nueva y cancelar descarta el temporal.
10. `GET /api/internal/cleanup-temporary-images`, protegido por `CRON_SECRET`, procesa hasta 500 registros vencidos por ejecución. Borra Storage temporal y el registro abandonado; si ya existe `finalPath`, solo limpia temporales y marca `CONFIRMED`. Rutas no asociables quedan pendientes y objetos sin registro no se enumeran ni borran automáticamente. `vercel.json` lo programa a las 03:00 UTC diariamente.

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
| 2026-08-08 | Validar imágenes sin transformarlas y limpiar temporales diariamente | Los archivos no conformes se rechazan; los aceptados conservan bytes, formato, resolución y metadata. El cron protegido elimina solo temporales vencidos asociables y nunca recursos finales. | `lib/images/*`, `app/api/internal/cleanup-temporary-images/route.ts`, `vercel.json` |
| 2026-08-19 | Merchandising como catálogo simple | Se reutilizan Zod, React Hook Form, autorización OWNER y el workflow de imágenes compensado; no se agrega slug porque no existen páginas individuales ni URLs por producto. La web lo oculta por completo si no hay productos activos. | `lib/merchandise/*`, `app/admin/**/merchandise/*`, `app/page.tsx` |
| 2026-08-22 | Pedidos web como preparación para WhatsApp | Revuelto no administra cocina ni estados de pedidos. El carrito se conserva localmente; el servidor recalcula y valida antes de generar el enlace. Efectivo y transferencia están implementados. Mercado Pago es configurable pero permanece técnicamente deshabilitado hasta una etapa con credenciales, Checkout Pro, webhook e idempotencia. | `lib/orders/*`, `components/public/order/*`, `app/api/orders/prepare/route.ts` |
| 2026-08-01 | No gestionar Auth users | Protege las cuentas creadas manualmente y separa identidad/autorización. | `lib/auth.ts` |

## Base de datos

- `AdminUser`: autorización para un UUID de Supabase Auth.
- `Bowl`, `BowlSize`: receta fija y sus tamaños SMALL/LARGE. Al borrar un bowl, sus tamaños se eliminan por cascada.
- `Branch`, `BusinessHour`: sucursal y un horario por día. El índice único `(branchId, dayOfWeek)` evita duplicados; las operaciones escriben los siete días y guardan días cerrados con `isClosed = true` y horas nulas. Al borrar una sucursal, sus horarios se eliminan por cascada.
- `Promotion`: promoción y programación semanal recurrente opcional mediante días y una franja horaria de Argentina. Conserva columnas de fechas históricas, que no usa el producto actualmente.
- `SiteContent`: conserva filas editoriales legacy y usa `key = site-config` como singleton estructurado de textos, contacto, footer, SEO y cuatro flags de pedidos.
- `GalleryItem`: imagen o miniatura de Instagram, enlace externo validado, orden y estado.
- `MerchandiseItem`: nombre, descripción opcional, precio positivo, imagen, estado, orden y timestamps; no contiene stock, variantes ni datos de compra.
- `LoginAttempt`: rate limit por hashes, sin datos personales en claro.
- `AdminSessionActivity`: HMAC de cookie administrativa, vencimiento inactivo y máximo absoluto de una hora.
- `TemporaryImage`: staging, temporal, estado, propietario y metadatos validados.
- `PublicOrderRateLimit`: contador temporal por HMAC de IP para limitar la preparación pública de pedidos; no almacena carritos ni pedidos comerciales.

## Operaciones manuales y pruebas

1. Crear las variables anteriores sin versionar valores; generar `SECURITY_HMAC_SECRET` aleatorio de 32+ caracteres.
2. Mantener `revuelto-temp` privado y `bucket-media` público. Revisar y ejecutar manualmente [`STORAGE_SECURITY.sql`](./STORAGE_SECURITY.sql): niega acceso directo a ambos buckets para `anon`/`authenticated`; la lectura pública queda solo por la URL pública de finales.
3. En Cloudflare Turnstile crear el widget, permitir hostnames local/producción, usar action `admin-login` y configurar las tres variables de Turnstile. La Secret Key no sale del servidor.
4. Antes de cualquier cambio futuro de esquema, ejecutar `npx prisma migrate status` y tomar su resultado como fuente de verdad. Al 2026-08-22 las siete migraciones previas están aplicadas y `20260822000100_add_public_ordering` está pendiente. No ejecutar `migrate deploy`, `migrate dev`, `db push` ni reset sin autorización explícita.
5. Mantener `CRON_SECRET` fuera de Git. El cron diario está declarado y validado en `vercel.json`; su endpoint rechaza solicitudes sin secreto o con secreto incorrecto.
6. Probar manualmente el CRUD de bowls: alta con dos precios, slug duplicado, edición, estado, selección, arrastre, cambio y cancelación de imagen, y límites 5 MB/6000×6000/24 MP. Para borrar, cancelar primero, luego intentar con un nombre distinto y finalmente escribir exactamente el nombre; verificar que sus tamaños desaparezcan.
7. Probar el CRUD de sucursales: alta/edición, siete días, abiertos/cerrados, validación de horas, teléfono opcional, activación/desactivación y visibilidad pública. Para borrar, repetir la confirmación exacta y verificar que sus horarios desaparezcan. Mantener además las pruebas manuales de login y sesión. Nunca cambiar ni probar automáticamente contraseñas reales.
8. Probar la navegación pública en escritorio y celular alternando contenido activo/inactivo: cada enlace Carta, Promociones o Sucursales debe aparecer junto con su sección y desaparecer con ella.
9. Probar promociones: desactivar la demo actual y comprobar que desaparezcan menú/sección; crear y editar una promoción; activar/desactivar; cargar, reemplazar, quitar y cancelar imagen. Una promoción activa debe mostrarse aun fuera de su franja, junto con el texto de días y horario; una inactiva no debe mostrar tarjeta, menú ni sección. Probar días completos sin horas y horario diario sin días. Los rangos que cruzan medianoche deben rechazarse. Tras un cambio de esquema, detener y volver a iniciar el servidor; `npm run dev` ejecuta `prisma generate` antes de iniciar Next. El seed quedó configurado para futuras ejecuciones con la demo inactiva, pero no se ejecutó ni se alteró la fila actual.

Pruebas de pedidos realizadas el 2026-08-22 cubren carrito, límites, estado inválido de localStorage, Zod estricto, productos/sucursales/métodos no disponibles, recálculo de precios, efectivo, transferencia y WhatsApp. La validación final completa debe conservar además las pruebas existentes. No se usaron contraseñas ni se modificaron cuentas.

Verificación HTTP local sobre el build de producción: sin cookies, `/admin/bowls` redirige 307 al login y los handlers de bowls (alta/edición/estado), promociones, sucursales, contenido, galería e imágenes responden 401. El cron sin Bearer también responde 401. No se invocó el cron con secreto ni se ejecutó ninguna mutación real.

Verificación local adicional del 2026-08-04: `GET http://localhost:3000/` respondió 200 y el HTML real contenía `#inicio`, `#carta`, `#promociones` y `#sucursales`, todos con un `section id` correspondiente y ningún destino faltante para los datos actuales. El control visual integrado del navegador no pudo conectarse por un fallo de su entorno; la inspección visual responsive en navegador queda como prueba manual, aunque el menú usa flex wrapping y una disposición específica bajo 560 px.

## Auditoría de seguridad 2026-08-10

- Todos los Route Handlers sensibles usan `getOwnerRouteAuthorization` además del proxy: 401 para sesión Supabase ausente/inválida, 403 para una cuenta sin `AdminUser` OWNER activo o para sesión administrativa inválida, 503 para configuración incompleta y 500 genérico para fallos inesperados.
- Cada cuerpo administrativo se valida con Zod antes de persistir; los identificadores de recursos se validan como UUID y las imágenes temporales verifican `ownerId` en cada paso. Las operaciones existentes no admiten borrado múltiple, por lo que no hay un endpoint de eliminación masiva que auditar.
- Las imágenes aceptan únicamente JPEG, PNG o WebP reales, una sola imagen, hasta 5 MB, 6000×6000 y 24 MP para todos los destinos. Sharp solo inspecciona: no rota, redimensiona, recomprime, elimina metadata ni convierte. La intención queda limitada mediante PostgreSQL a 8 solicitudes por OWNER cada 10 minutos; el servidor elige siempre UUID, rutas, extensión y Content-Type.
- Sentry se inicializa para servidor, edge y navegador. `beforeSend` y `beforeSendTransaction` eliminan usuario, request, headers, cookies, cuerpos, datos extra, contextos, breadcrumbs, mensajes, nombres de transacción y spans; `sendDefaultPii` queda desactivado y tracing en 0. Los handlers, autenticación, Storage/Sharp y frontend reportan solo fallos inesperados de forma segura.
- AuthVerify no se incorporó: no es una dependencia instalada ni se proporcionó una API que valide correctamente el JWT/sesión emitido por Supabase. Supabase Auth más `AdminUser` OWNER activo mantiene una única fuente de verdad.
- No se agrega CORS permisivo. La ausencia de `Access-Control-Allow-Origin` bloquea llamadas cross-origin en navegadores, pero no es una barrera de seguridad: cada endpoint mantiene autenticación y autorización del servidor.

### Configuración manual verificada

1. Supabase Storage fue revisado manualmente: `revuelto-temp` es privado y `bucket-media` es público para lectura; ambos tienen límite de 5 MB y MIME JPEG/PNG/WebP. Se conservan los archivos originales validados sin conversión automática. El SQL de auditoría y políticas restrictivas se conserva en `docs/STORAGE_SECURITY.sql`.
2. Sentry está configurado en `.env.local`, sanitizado y probado. La ruta temporal de prueba ya no existe. `NEXT_PUBLIC_SENTRY_DSN` es un identificador público de ingesta; nunca exponer `SENTRY_AUTH_TOKEN` ni claves de Storage.
3. `CRON_SECRET` está configurado y `vercel.json` fue validado. El endpoint se auditó con ausencia de secreto y secreto incorrecto, ambos con respuesta 401; en la auditoría había 0 candidatos a cleanup.

## Pendientes

- Revisar y, solo con autorización explícita, aplicar `20260819000100_add_merchandise` antes de probar el CRUD contra la base real.
- Probar manualmente dashboard, CRUD de merchandising, navegación condicional, grilla 3/2/1, título crema y el intercambio de ilustraciones.
- Añadir integración contra un entorno de prueba aislado, nunca cuentas o datos reales.
