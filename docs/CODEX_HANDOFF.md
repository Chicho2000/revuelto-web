# Handoff completo para continuar Revuelto en otra computadora

Actualizado: 2026-08-19 (America/Buenos_Aires).

Este documento está dirigido a una nueva instancia de Codex sin acceso a la
conversación original. Resume el estado comprobado del repositorio, el último
estado conocido de los servicios externos y las reglas permanentes del
proyecto. No contiene contraseñas, tokens, DSN reales, URLs de conexión,
service role, `CRON_SECRET` ni otros valores sensibles.

> **Regla de interpretación:** distinguir siempre entre (a) código presente en
> el repositorio, (b) migraciones confirmadas en Supabase y (c) configuración
> manual pendiente en servicios externos. No asumir que el esquema local ya
> está aplicado en la base remota.

## 0. Estado de Git y traslado a la nueva computadora

- Repositorio: `revuelto-web`.
- Rama actual: `main`.
- `HEAD` y `origin/main` apuntan a `40b93b1`:
  `feat: refuerza seguridad, Storage y observabilidad`.
- Commit anterior importante: `dd71a77`:
  `feat: implementa web pública y panel administrativo de Revuelto`.
- El árbol de trabajo **no está limpio**. Hay un rediseño público y una
  reorganización de referencias visuales todavía sin commit ni push.
- Clonar únicamente GitHub en la nueva computadora recuperará hasta
  `40b93b1`, pero perderá el trabajo visual no versionado. Para trasladar el
  estado exacto hay que copiar la carpeta completa del proyecto (sin depender
  de `.next` ni `node_modules`) o preservar explícitamente todos los cambios
  tracked y untracked.
- No hay un `npm run dev` ejecutándose al redactar este documento.
- No se debe copiar `.env.local` por Git. Transferir las variables reales por
  un canal seguro y recrear el archivo localmente.
- Cambios locales relevantes sin commit:
  - nuevo `app/public.css`;
  - rediseño de `app/page.tsx` y ajuste de `app/layout.tsx`;
  - `PublicHeader`, `RevealController`, cambios en `GalleryDisplay`;
  - componentes locales auditados `ClickSpark` y `CurvedLoop` y
    `components.json`;
  - reorganización de `brand-assets/references/` por categorías, conservando
    las imágenes bajo nombres descriptivos;
  - actualizaciones de `PROJECT_CONTEXT.md` y `PROJECT_DOCUMENTATION.md`;
  - bloque de reglas de Next.js agregado automáticamente a `AGENTS.md`.
- Dedicación informada en la conversación/documentación: aproximadamente
  12 horas acumuladas hasta una actualización anterior y 5 horas 30 minutos
  para la porción posterior al push `dd71a77`. Son cifras declarativas, no un
  registro automático de tiempo.

## 1. Objetivo general

Revuelto es un negocio de bowls de huevos revueltos, orientado principalmente
a personas que salen del gimnasio. El producto de software combina:

1. una página pública dinámica con carta, promociones, sucursales, galería,
   contacto y contenido de marca;
2. un panel administrativo privado para los dueños;
3. persistencia en Supabase/PostgreSQL mediante Prisma;
4. Supabase Auth para identidad;
5. Supabase Storage para imágenes;
6. controles de seguridad, observabilidad y limpieza automática de temporales.

La identidad debe sentirse joven, informal, fresca, nutritiva, cercana,
divertida y orgánica. El eslogan es “Fresco, nutritivo, resuelto.”

## 2. Stack tecnológico y versiones importantes

Estado instalado/verificado el 2026-08-19:

| Tecnología | Versión/uso actual |
| --- | --- |
| Node.js | 22.14.0 |
| npm | 10.9.2 |
| Next.js | 16.3.0, App Router y Turbopack en desarrollo |
| React / React DOM | 19.2.4 |
| TypeScript | 5.9.3 detectado por Prisma; modo `strict` |
| Prisma / Client | 7.9.1 |
| `@prisma/adapter-pg` | 7.9.1 |
| PostgreSQL | Supabase, accedido con `pg` 8.22.0 |
| Supabase JS | 2.111.0 |
| `@supabase/ssr` | 0.12.3 |
| Tailwind CSS | 4.x mediante `@tailwindcss/postcss` |
| Zod | 4.4.3 |
| React Hook Form | 7.84.0 |
| Sharp | 0.35.3 |
| Sentry Next.js | 10.69.0 |
| ESLint | 9.x con `eslint-config-next` 16.3.0 |
| Despliegue previsto | Vercel |

Scripts principales:

```text
npm run dev              # prisma generate && next dev
npm run build            # prisma generate && next build
npm run lint
npm test
npm run prisma:generate
npm run prisma:validate
npm run prisma:seed
```

En PowerShell con políticas de ejecución restrictivas puede ser necesario usar
`npm.cmd` y `npx.cmd` en vez de `npm`/`npx`.

Next.js 16.3.0 puede cambiar convenciones respecto de versiones anteriores.
Antes de escribir código Next.js, leer la guía pertinente en
`node_modules/next/dist/docs/`, tal como exige `AGENTS.md`.

## 3. Arquitectura actual

- Una sola aplicación Next.js; no existe ni debe crearse un backend Express.
- App Router con Server Components por defecto.
- Route Handlers para mutaciones, login, actividad, logout, imágenes y cron.
- Client Components solo donde hay interacción: formularios, navegación móvil,
  expiración por inactividad, carrusel, revelado progresivo y efectos visuales.
- Prisma vive exclusivamente en servidor. `lib/prisma.ts` y los servicios usan
  `server-only`; nunca importar Prisma Client desde un Client Component.
- Prisma 7 usa `@prisma/adapter-pg`; `DATABASE_URL` se entrega al adapter.
- La página pública no exige autenticación.
- Las páginas y todos los Route Handlers administrativos vuelven a verificar
  autenticación y autorización en servidor.
- `proxy.ts` solo refresca/verifica la sesión Supabase y redirige navegación;
  no decide roles y deja pasar handlers sensibles para que respondan JSON
  401/403 por sí mismos.
- No se usa fallback permanente de datos mock. Si falta configuración, la UI
  muestra un estado explícito.
- La carga pública obtiene contenido, bowls, promociones, sucursales y galería
  en paralelo, una vez por request cacheada con `React.cache`.
- `app/page.tsx` es dinámico (`force-dynamic`) y genera metadata SEO desde el
  singleton de contenido.

## 4. Estado conocido de Supabase

### 4.1 Auth

- Supabase Auth es la fuente de identidad.
- El login con email/contraseña funciona mediante
  `POST /api/admin/login` y `signInWithPassword`.
- No existe registro público y nunca debe habilitarse.
- Las cuentas de los dueños se crean y administran manualmente en Supabase.
- La aplicación no crea, edita, elimina ni prueba contraseñas/cuentas Auth.
- Una identidad Auth por sí sola no otorga acceso: debe mapear a un
  `AdminUser` OWNER activo.

### 4.2 PostgreSQL

- PostgreSQL está alojado en Supabase.
- Runtime serverless: Supavisor Transaction Pooler, puerto 6543,
  `pgbouncer=true` y `connection_limit=1`.
- Prisma CLI/migraciones: Supavisor Session Pooler, puerto 5432.
- No usar como estándar la conexión directa `db.[project-ref]` si el entorno no
  dispone de IPv6.
- El último estado remoto realmente verificado de migraciones está detallado
  en la sección 7; no aplicar cambios de esquema sin autorización explícita.

### 4.3 Storage y buckets

La aplicación espera exactamente:

| Bucket | Estado/uso esperado |
| --- | --- |
| `revuelto-temp` | Privado; staging y copias temporales validadas. Debe permitir JPEG, PNG y WebP, máximo 5 MB. |
| `bucket-media` | Público; imágenes finales. Debe permitir JPEG, PNG y WebP, máximo 5 MB. |

Última auditoría documentada de solo lectura, 2026-08-10:

- `revuelto-temp` era privado, permitía JPEG/PNG/WebP, pero tenía límite de
  10 MB. Falta bajarlo manualmente a 5 MB.
- `bucket-media` era público y ya limitaba 5 MB, pero permitía solo WebP.
  Falta habilitar manualmente `image/jpeg`, `image/png` e `image/webp`.
- La aplicación no crea ni reconfigura buckets.
- La service role opera Storage solo desde servidor.

### 4.4 RLS

- Migración 001 activa RLS sin políticas permisivas para:
  `AdminUser`, `Bowl`, `BowlSize`, `Branch`, `BusinessHour`, `Promotion` y
  `SiteContent`.
- Migración 002 activa RLS sin políticas para:
  `LoginAttempt`, `AdminSessionActivity` y `TemporaryImage`.
- Migración 006 activa RLS para `GalleryItem`, pero su aplicación remota no
  está confirmada.
- Auditoría de `storage.objects` del 2026-08-10: `pg_policies` no devolvió
  filas; no había una política permisiva conocida que eliminar.
- `docs/STORAGE_SECURITY.sql` contiene auditoría y dos políticas RESTRICTIVE
  opcionales para negar acceso directo de `anon`/`authenticated`. Es SQL
  manual: la aplicación no lo ejecuta y no consta como aplicado.
- La URL pública de `bucket-media` sirve lectura del objeto final; las
  políticas restrictivas no bloquean service role, upload firmado ni entrega
  pública del bucket.

## 5. Usuarios administradores y reglas inmutables

- El diseño prevé **dos cuentas de dueños** creadas manualmente en Supabase
  Auth y dos filas `AdminUser` vinculadas por `authUserId`.
- Sus emails, UUID, nombres y credenciales reales no están documentados en el
  repositorio y no deben inferirse ni copiarse a este archivo.
- Único rol actual: `OWNER`.
- Para administrar: `role = OWNER` e `isActive = true`.
- Nunca habilitar registro público.
- Nunca cambiar, restablecer, probar, enumerar o borrar automáticamente las
  cuentas reales de los dueños.
- Nunca convertir la service role en mecanismo de Auth/autorización.
- El seed no crea usuarios Auth ni `AdminUser`.
- Si una cuenta autenticada no tiene OWNER activo, se ejecuta `signOut`, se
  registra el intento inválido correspondiente y recibe el mismo mensaje
  genérico que credenciales incorrectas.

## 6. Modelos Prisma actuales

El esquema local es `prisma/schema.prisma`. Prisma Client se genera en
`generated/prisma` y no se versiona.

### `AdminUser`

- UUID interno, `authUserId` UUID único, nombre, rol OWNER, activo, timestamps.
- Relaciones con sesiones administrativas e imágenes temporales.
- Borrar un admin elimina sus sesiones por cascada, pero `TemporaryImage`
  restringe el borrado del owner.

### `LoginAttempt`

- HMAC de IP y email normalizado, contador, comienzo de ventana, último fallo,
  bloqueo opcional, expiración y timestamps.
- Índice único `(ipHash, emailHash)` e índices de expiración/bloqueo.
- No guarda IP ni email en claro.

### `AdminSessionActivity`

- UUID, admin, HMAC de cookie único, última actividad, vencimiento inactivo,
  vencimiento absoluto, timestamps.
- Índices por admin y vencimientos.
- No guarda JWT, refresh token, contraseña ni cookie en claro.

### `TemporaryImage`

- Owner, destino (`BOWL`, `PROMOTION`, `BRANCH`, `GALLERY`), estado, rutas de
  staging/temporal/final, bytes, ancho, alto, expiraciones, último error y
  timestamps.
- Estados: `STAGING`, `PROCESSING`, `READY`, `CLEANUP_PENDING`, `DISCARDED`,
  `CONFIRMED`.
- Rutas staging/temp/final son únicas; índices por owner/estado y expiración.

### `Bowl`

- Nombre, slug único, descripción corta/larga, URL/path de imagen, destacado,
  disponible, archivado, orden y timestamps.
- Relación uno-a-muchos con tamaños.
- Visible si `isAvailable=true` e `isArchived=false`.

### `BowlSize`

- Bowl, tipo `SMALL`/`LARGE`, onzas, huevos, precio decimal, notas,
  disponibilidad y timestamps.
- Único `(bowlId, size)`; cascada al borrar el bowl.
- Restricciones de DB: cantidades positivas, precio no negativo, SMALL=25 oz
  y LARGE=35 oz.

### `Branch`

- Nombre, dirección, ciudad, `mapsUrl` legado obligatorio,
  `whatsappNumber`, activo y timestamps.
- Las altas actuales inicializan `mapsUrl` como cadena vacía y las ediciones no
  pisan un valor legado.
- Relación con siete horarios; visible si `isActive=true`.

### `BusinessHour`

- Sucursal, día, apertura/cierre opcionales y `isClosed`.
- Único `(branchId, dayOfWeek)`; cascada al borrar sucursal.

### `Promotion`

- Título, descripción, imagen URL/path, fechas legacy opcionales, días
  semanales, hora inicial/final, activo y timestamps.
- El producto actual ignora `startDate`/`endDate` para visibilidad; se conservan
  para no destruir datos históricos.
- Visible únicamente si `isActive=true`; la programación es informativa.

### `SiteContent`

- Conserva `key`, `title`, `content` legacy y usa `key = "site-config"` como
  singleton estructurado.
- Campos: hero, marca, títulos/descripciones de carta/promociones/sucursales/
  galería, WhatsApp, Instagram, TikTok, footer, título y descripción SEO.

### `GalleryItem`

- Tipo `IMAGE` o `INSTAGRAM_VIDEO`, título, descripción, `imagePath`, URL
  externa, orden, activo y timestamps.
- No aloja videos: para video guarda una miniatura validada y enlace oficial a
  Instagram.

## 7. Migraciones y estado conocido

Orden local exacto:

| Migración | Último estado remoto conocido | Contenido |
| --- | --- | --- |
| `20260801000000_init` | Aplicada, verificada 2026-08-03 | Esquema inicial, enums, negocio y checks. El comentario interno que dice “not applied” quedó obsoleto respecto de la auditoría posterior; no editar el archivo aplicado. |
| `20260801000100_enable_row_level_security` | Aplicada, verificada 2026-08-03 | RLS sin políticas en tablas de negocio. |
| `20260801000200_admin_security_and_temporary_images` | Aplicada, verificada 2026-08-03 | LoginAttempt, sesión, TemporaryImage, checks, relaciones y RLS. |
| `20260801000300_add_admin_session_absolute_expiry` | Pendiente según última verificación documentada | Agrega `absoluteExpiresAt`, rellena desde `createdAt + 1 hour`, NOT NULL e índice. |
| `20260804000100_add_promotion_weekly_schedule` | Pendiente según última verificación documentada | Días y franja horaria, con checks de par, formato y orden. |
| `20260804000200_add_site_content_and_gallery` | Pendiente según última verificación documentada | Agrega `GALLERY`, amplía SiteContent, crea singleton y GalleryItem, índice y RLS. |

Advertencia importante:

- Hubo uso visual posterior del contenido/galería, pero no existe una nueva
  consulta documentada a `_prisma_migrations` que confirme que 003–006 estén
  aplicadas en la base remota. No convertir observaciones de UI en evidencia
  de migración.
- El error `SiteContent.heroTitle does not exist` apareció precisamente cuando
  el cliente Prisma local esperaba la migración 006 y la base todavía no tenía
  la columna.
- `getSiteContent` tiene fallback de lectura a filas legacy `hero`/`about` ante
  P2022; guardar contenido estructurado o usar galería sigue requiriendo la
  migración.
- Nunca reescribir una migración ya aplicada.
- No ejecutar `migrate dev`, `db push`, reset ni `migrate deploy` contra
  Supabase sin autorización explícita y una verificación previa de
  `_prisma_migrations`.
- Cuando se autorice, aplicar pendientes en el orden existente mediante
  `npx prisma migrate deploy` y verificar el resultado.

## 8. Login y autorización

Flujo exacto:

1. `/admin/login` es público y solicita email, contraseña y Turnstile desde el
   primer envío.
2. `POST /api/admin/login` valida JSON estricto con Zod.
3. Normaliza email (`trim` + minúsculas) y obtiene IP desde
   `x-forwarded-for`/`x-real-ip`.
4. Calcula HMAC de IP y email con namespaces separados.
5. Consulta rate limit; si está bloqueado responde genéricamente.
6. Verifica Turnstile en servidor.
7. Ejecuta `signInWithPassword` en Supabase Auth.
8. Busca `AdminUser` por UUID Auth y exige OWNER activo.
9. Crea la sesión administrativa opaca propia y setea su cookie.
10. Borra el contador de fallos al éxito.

Protección del panel:

- Grupo protegido: `app/admin/(protected)`.
- `getOwnerAccess()` exige configuración, usuario Supabase válido, OWNER activo
  y sesión administrativa propia activa.
- El layout redirige no autenticados/no autorizados a login; muestra estados
  claros para configuración faltante o sesión vencida.
- Todos los handlers de bowls, sucursales, promociones, contenido, galería,
  imágenes y actividad llaman `getOwnerRouteAuthorization()`.
- El proxy permite los handlers sensibles para que su autorización servidor
  entregue JSON; no se confía en redirecciones ni en UI.
- Respuestas inesperadas son genéricas y no incluyen Prisma, SQL ni stack.

## 9. Turnstile

- Cloudflare Turnstile es obligatorio desde el primer intento.
- Site key se obtiene en Server Component y se pasa al formulario; no se lee
  directamente desde un Client Component.
- Secret key solo servidor.
- Verificación por Siteverify exige simultáneamente:
  - respuesta HTTP correcta;
  - `success=true`;
  - action exacta `admin-login`;
  - hostname exacto de `TURNSTILE_EXPECTED_HOSTNAME`.
- Se envía IP remota a Siteverify.
- El widget se resetea tras cualquier respuesta fallida porque los tokens son
  de un solo uso.
- Fallos de Turnstile/configuración/proveedor no incrementan intentos de
  credenciales.
- Configurar hostnames por entorno (localhost y producción) manualmente.

## 10. Rate limiting

### Login

- Identidad: par HMAC(IP, email normalizado).
- Ventana: 15 minutos.
- Máximo: 5 fallos de credenciales o autorización dentro de la ventana.
- Bloqueo: 15 minutos desde el quinto fallo.
- Éxito: elimina el registro.
- Solo errores 4xx de credenciales y usuario autenticado sin OWNER activo
  incrementan el contador.
- Turnstile, timeout, red, base o proveedor no incrementan.
- Persistente en PostgreSQL; no depende de memoria de una Function.

### Intenciones de imagen

- Máximo 8 intenciones por OWNER cada 10 minutos.
- Se cuenta mediante `TemporaryImage` en PostgreSQL.
- Exceso produce error de límite y evita crear otra URL firmada.

## 11. Sesiones administrativas y expiraciones

- Además de las cookies de Supabase existe cookie propia
  `revuelto_admin_session`.
- Valor aleatorio de 32 bytes codificado base64url; la DB guarda solo HMAC.
- Cookie HTTP-only, SameSite=Lax, `Path=/admin`, Secure en producción.
- Inactividad máxima: 30 minutos.
- Vencimiento absoluto: 1 hora desde login.
- `expiresAt = min(ahora + 30 min, absoluteExpiresAt)`.
- El cliente escucha click, teclado, input, touch y pointer; reinicia su timer y
  sincroniza al servidor como máximo una vez por minuto.
- El servidor valida cookie, owner, vencimiento inactivo y absoluto en cada
  acceso protegido. El cliente no es la única defensa.
- Logout borra la fila de sesión, ejecuta `supabase.auth.signOut()`, borra la
  cookie propia y aplica cookies Supabase.
- La migración que agrega `absoluteExpiresAt` sigue marcada como pendiente en
  la última auditoría remota; confirmar antes de usar otra base/computadora.

## 12. Sentry y sanitización

- Integrado para servidor, edge y navegador.
- Servidor/edge usan `SENTRY_DSN`; navegador usa
  `NEXT_PUBLIC_SENTRY_DSN`.
- `enabled` depende de que exista el DSN correspondiente.
- `sendDefaultPii=false`.
- `includeLocalVariables=false` en servidor.
- Tracing deshabilitado: `tracesSampleRate=0`.
- Breadcrumbs deshabilitados con `beforeBreadcrumb: () => null`.
- `beforeSend` y `beforeSendTransaction` usan `sentry-sanitize.ts`.
- Sanitización elimina: user, request, URL/headers/cookies/body incluidos en
  request, extra, contexts, server name, modules, transacción, mensajes,
  logentry, breadcrumbs y spans.
- Los mensajes de excepciones se reemplazan por texto redactado.
- Solo conserva tags controlados `area` y `runtime`, más ubicaciones de stack.
- `reportUnexpectedServerError` escribe en consola solo `{area, errorName}` y
  captura la excepción sanitizada.
- Se creó temporalmente `/api/dev/test-sentry` con error
  `REVUELTO_SENTRY_TEST`, la prueba llegó correctamente a Sentry y luego se
  eliminaron la ruta, su test y la nota temporal. No debe existir esa ruta.
- No modificar la sanitización real al continuar pruebas.

## 13. Vercel Cron y cleanup de `TemporaryImage`

- Ruta: `GET /api/internal/cleanup-temporary-images`.
- Runtime Node, dinámico, `maxDuration=60`.
- Autenticación: `Authorization: Bearer <CRON_SECRET>`.
- Comparación con `timingSafeEqual`; secreto mínimo 16 caracteres.
- `vercel.json`: diario a las 03:00 UTC (`0 3 * * *`).
- Procesa hasta 500 registros expirados por ejecución, ordenados por
  `expiresAt`.
- Solo considera no confirmados vencidos; valida que staging/temp pertenezcan
  a `staging/{ownerId}/` o `temp/{ownerId}/`.
- Si no hay `finalPath`: elimina staging/temp y borra el registro mediante
  operaciones idempotentes.
- Si hay `finalPath`: nunca borra el final; limpia temporales y marca
  `CONFIRMED`.
- Rutas ambiguas/inseguras quedan `CLEANUP_PENDING`.
- No enumera ni borra objetos huérfanos sin un registro `TemporaryImage`.
- Prueba local autenticada del 2026-08-12: HTTP 200, 9 temporales vencidos
  limpiados, 0 errores y ningún recurso final afectado.
- Pendiente externo: confirmar `CRON_SECRET` en Vercel, desplegar y observar el
  primer cron real. El código/schedule están listos; el despliegue no consta
  como verificado.

## 14. Reglas actuales de imágenes

Aplican a los destinos admitidos por la infraestructura:

- Formatos reales permitidos: JPEG, PNG y WebP.
- Máximo: 5 MiB (`5 * 1024 * 1024` bytes).
- Ancho máximo: 6000 px.
- Alto máximo: 6000 px.
- Área máxima: 24.000.000 píxeles (24 MP).
- Una sola página/frame.
- Se rechazan SVG, GIF, TIFF, BMP, HEIC, PDF, archivos renombrados, animados y
  cualquier formato no detectado realmente por Sharp.
- Archivo mayor a 5 MiB produce error diferenciable para HTTP 413; formato,
  dimensiones, megapíxeles o frames inválidos producen 400.
- Sharp se usa solo para inspección con `animated:true` y límite de píxeles.
- No redimensiona, rota, comprime, recomprime, elimina metadata ni convierte.
- Se conservan exactamente bytes, resolución, metadata y formato.
- JPEG sigue JPEG (`.jpg`, `image/jpeg`), PNG sigue PNG y WebP sigue WebP.
- Extensión y Content-Type se derivan del formato real, no del nombre enviado.
- La base registra bytes/ancho/alto del temporal validado.
- Aunque existe destino `BRANCH` en el enum de infraestructura, el modelo/CRUD
  actual de sucursales no guarda una imagen. No inventar un campo sin diseñar
  y migrar explícitamente esa funcionalidad.

## 15. Flujo de Storage temporal y definitivo

1. Un OWNER solicita `POST /admin/images/upload-intent` con solo el destino.
2. El servidor elige owner, UUID, bucket, prefijo y ruta
   `staging/{ownerId}/{uuid}`; el navegador no controla esos datos.
3. Crea `TemporaryImage` y URL firmada sin upsert para un objeto exacto en
   `revuelto-temp`.
4. La autorización de aplicación dura 10 minutos; el registro temporal expira
   a las 24 horas. La duración técnica de la URL también depende de Supabase.
5. El navegador sube directamente al bucket privado, evitando el límite de
   cuerpo de Vercel Functions.
6. `POST /admin/images/complete` reclama el registro de forma idempotente,
   verifica owner/estado/vencimiento, consulta tamaño real, descarga y valida.
7. Si cumple, guarda los mismos bytes en
   `temp/{ownerId}/{uuid}.{ext}` y elimina staging.
8. Al guardar la entidad, el servicio vuelve a validar el temporal, copia a
   `bucket-media` bajo `{segmento}/{entityId}/{uuid}.{ext}` y obtiene URL
   pública.
9. Orden compensado: preparar imagen final → persistir DB → confirmar temporal
   → recién entonces eliminar imagen anterior.
10. Si falla la DB, se intenta rollback de la copia final nueva y se conserva
    la anterior.
11. Si falla cleanup inmediato, queda estado para cron.
12. `POST /admin/images/discard` permite cancelar un temporal del mismo owner.

Segmentos finales actuales:

- bowls: `bowls/{bowlId}/{uuid}.{ext}`;
- promociones: `promotions/{promotionId}/{uuid}.{ext}`;
- galería: `gallery/{galleryItemId}/{uuid}.{ext}`.

## 16. CRUD de bowls

- Rutas UI: listado, alta y edición bajo `/admin/bowls`.
- Mutaciones protegidas:
  - POST `/admin/bowls/manage`;
  - PUT/DELETE `/admin/bowls/manage/{id}`;
  - PATCH `/admin/bowls/manage/{id}/status`.
- Zod exige nombre, slug normalizado, descripción, estado, imagen temporal
  opcional y exactamente SMALL/LARGE con precios positivos.
- Slug solo minúsculas, números y guiones; conflicto Prisma P2002 → HTTP 409
  comprensible.
- Producto sin toppings: cada bowl es receta fija.
- SMALL siempre 25 oz y LARGE siempre 35 oz.
- Implementación actual crea SMALL con 3 huevos y LARGE con 5; el formulario
  administra precios. En edición se actualizan onzas/precio y se preservan
  `eggQuantity` y `quantityNotes` existentes.
- Alta usa nested write atómico Bowl + dos BowlSize.
- Edición usa upsert nested para ambos tamaños.
- Activar/desactivar usa `isAvailable`.
- Borrado definitivo exige escribir exactamente el nombre en UI y servidor;
  tamaños se borran por cascada y la imagen final se intenta eliminar después
  de la DB.
- Reemplazo de imagen usa workflow compensado y conserva la anterior si falla.

## 17. CRUD de promociones

- Rutas UI: listado, alta y edición bajo `/admin/promotions`.
- Mutaciones protegidas: POST, PUT y PATCH de estado bajo
  `/admin/promotions/manage`.
- No existe DELETE definitivo de promociones por decisión actual.
- Título obligatorio (máx. 160) y cuerpo obligatorio (máx. 3000).
- Programación recurrente opcional: hasta siete días y una única franja diaria
  `HH:mm`; ambas horas juntas, cierre posterior, sin cruzar medianoche.
- Semántica:
  - días + horas: esos días/franja;
  - días sin horas: esos días completos;
  - horas sin días: todos los días en esa franja;
  - ambos vacíos: todos los días/sin restricción semanal.
- La programación es informativa; solo `isActive` oculta/muestra.
- `startDate`/`endDate` permanecen en DB como legado y el flujo actual no los
  modifica ni usa para visibilidad.
- Orden público: `createdAt` descendente.
- Imagen opcional; alta, reemplazo y quita usan workflow compensado. En quita,
  primero actualiza PostgreSQL y luego intenta borrar el objeto previo.

## 18. CRUD de sucursales y horarios

- Rutas UI: listado, alta y edición bajo `/admin/branches`.
- Mutaciones protegidas: POST, PUT, DELETE y PATCH de estado.
- Datos: nombre, dirección, ciudad, teléfono/WhatsApp opcional y activo.
- Zod exige exactamente siete días sin duplicados.
- Día abierto exige apertura/cierre `HH:mm` y cierre posterior.
- Día cerrado persiste `isClosed=true` y horas nulas.
- Alta crea Branch + siete BusinessHour con nested write atómico.
- Edición hace upsert de los siete horarios y preserva `mapsUrl` legado.
- Activación determina visibilidad pública.
- Borrado definitivo exige escribir exactamente el nombre; horarios se borran
  por cascada.
- La página pública completa días ausentes como cerrados para no romper la UI.

## 19. Contenido general

- UI: `/admin/content`.
- Mutación: PUT `/admin/content/manage`, protegida y validada con Zod.
- Singleton: `SiteContent.key = "site-config"`; filas legacy `hero`/`about` se
  conservan.
- Campos administrables:
  - hero: título obligatorio, antetítulo/subtítulo, descripción, texto y
    destino del botón;
  - bloque de marca;
  - títulos/descripciones de carta, promociones, sucursales y galería;
  - WhatsApp (número, texto, mensaje y habilitación);
  - URLs oficiales Instagram/TikTok;
  - footer;
  - título SEO (máx. 70) y descripción SEO (máx. 170).
- Botón hero acepta ruta interna, hash seguro o URL HTTPS sin credenciales.
- Redes aceptan hostnames oficiales y HTTPS.
- WhatsApp habilitado exige número; genera `wa.me` y mensaje codificado.
- Opcionales vacíos se guardan como NULL y no reaparecen como defaults al
  recargar una fila existente.
- SEO no se muestra como texto visible en el body: `generateMetadata()` lo
  coloca en `<title>` y meta description para navegador/buscadores/compartidos.
- Guardar un elemento de galería es independiente; no requiere volver a
  presionar “Guardar cambios” en contenido general.

## 20. Galería

- UI: `/admin/content/gallery`, con alta y edición.
- Tipos: `IMAGE` e `INSTAGRAM_VIDEO`.
- Ambos requieren imagen/miniatura en alta.
- Video no se carga ni reproduce localmente; solo miniatura + enlace.
- Instagram válido: HTTPS, sin credenciales/puerto, hostname exacto
  `instagram.com`, `www.instagram.com` o `m.instagram.com`, ruta `p`, `reel`,
  `reels` o `tv`. Se normaliza a `www.instagram.com` y se eliminan query/hash.
- IMAGE puede llevar URL externa HTTPS segura opcional.
- Enlaces públicos abren nueva pestaña con `noopener noreferrer`.
- Orden: `sortOrder`, luego `createdAt`, luego `id`.
- Visible si está activo, tiene `imagePath` y, si es video, URL Instagram
  válida.
- Hasta 3 elementos públicos: grilla.
- Desde 4: carrusel circular automático cada 5 segundos, con anterior,
  siguiente e indicadores.
- Autoplay se pausa en hover/foco/interacción y se desactiva con
  `prefers-reduced-motion`.
- Alta/edición se persiste solo al presionar Guardar en su propio formulario.
- Activar/desactivar existe; no hay DELETE definitivo actual.
- La galería muestra una miniatura del Reel, no una porción real del video. Para
  reproducción propia haría falta diseñar carga/hosting de video, fuera del
  alcance actual.

## 21. Navegación pública condicional

- `lib/public-visibility.ts` es la fuente de verdad para colecciones visibles y
  navegación.
- IDs: `carta`, `promociones`, `sucursales`, `galeria`.
- Si una colección no tiene contenido público válido, no se renderizan enlace,
  título, contenedor ni ancla de esa sección.
- Bowls: disponibles y no archivados.
- Promociones: activas, sin filtrar por horario/fecha.
- Sucursales: activas.
- Galería: activa, con imagen y URL válida cuando corresponde.
- El mismo contrato produce `hasBowls`, `hasPromotions`, `hasBranches`,
  `hasGallery`, `menuItems` y `sectionIds`; evita links a IDs inexistentes.
- Header público actual: sticky, logo local, menú responsive y cierre por Escape.

## 22. Variables de entorno necesarias

Solo nombres y propósito; nunca copiar valores al documento o Git:

| Variable | Exposición | Propósito |
| --- | --- | --- |
| `DATABASE_URL` | Privada | Runtime Prisma vía Transaction Pooler 6543. |
| `DIRECT_URL` | Privada | Prisma CLI/migraciones vía Session Pooler 5432. |
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública | Publishable Key para Auth/SSR. |
| `SUPABASE_SERVICE_ROLE_KEY` | Privada | Solo operaciones Storage en `storage-admin.ts`. |
| `SECURITY_HMAC_SECRET` | Privada, mínimo 32 chars | HMAC de IP/email/cookie. |
| `TURNSTILE_SITE_KEY` | Pública por entrega del servidor | Widget Turnstile. |
| `TURNSTILE_SECRET_KEY` | Privada | Siteverify. |
| `TURNSTILE_EXPECTED_HOSTNAME` | Privada/configuración | Hostname exacto esperado. |
| `CRON_SECRET` | Privada, mínimo 16 chars | Bearer del cron. |
| `SENTRY_DSN` | Privada | Ingesta servidor/edge. |
| `NEXT_PUBLIC_SENTRY_DSN` | Pública | Ingesta del navegador; no es token de cuenta. |

No agregar `NEXT_PUBLIC_SUPABASE_ANON_KEY`: esta implementación usa la
Publishable Key actual. Nunca usar prefijo `NEXT_PUBLIC_` para service role,
secreto HMAC, Turnstile secret, cron o conexiones DB.

## 23. Decisiones técnicas importantes

- **App Router sin Express:** una sola app reduce superficie y duplicación.
- **Prisma solo servidor:** evita credenciales/queries en cliente.
- **Auth separado de autorización:** Supabase identifica; AdminUser OWNER
  activo autoriza.
- **Proxy no decide roles:** evita que una redirección sea la única defensa.
- **Service role solo Storage:** mínimo privilegio; nunca Auth/cookies/Prisma.
- **Dos buckets y staging directo:** originales no confiables quedan privados y
  no atraviesan el body limit de Vercel.
- **No transformar imágenes:** el negocio pidió conservar calidad/formato;
  se valida y rechaza en vez de convertir.
- **Nested writes en bowls/sucursales:** atomicidad sin depender de
  transacciones interactivas problemáticas con pooler serverless.
- **Workflow compensado Storage + DB:** no existe transacción distribuida;
  preparar/persistir/confirmar/rollback minimiza inconsistencias.
- **HMAC en vez de datos claros:** rate limit/sesión correlacionan sin persistir
  IP, email ni cookie.
- **Doble expiración:** 30 min inactiva más 1 h absoluta limita sesiones largas.
- **Promoción semanal informativa:** simplifica expectativas y evita ocultar
  contenido por zona horaria; activación manual es fuente de visibilidad.
- **Contenido singleton sin borrar legacy:** migración aditiva y recuperable.
- **Galería sin embeds/video alojado:** evita scripts externos, descarga de
  Reels y complejidad de video; usa miniatura y enlace oficial.
- **Menú derivado de datos visibles:** no hay navegación rota.
- **Sentry extremadamente sanitizado y sin tracing:** observabilidad de stack
  sin PII/request/bodies.
- **Cron conservador:** solo borra rutas inequívocamente asociadas; prefiere
  dejar basura pendiente antes que eliminar un final válido.
- **Diseño público progresivo:** Server Components conservan datos; animaciones
  respetan movimiento reducido y el contenido sigue visible si JS falla.

## 24. Bugs importantes y resolución

| Problema | Causa | Resolución/estado |
| --- | --- | --- |
| Bucle en `/admin/login` | El layout protegido incluía login. | Se separó `app/admin/(protected)`; login quedó público. |
| Login válido rechazado tras varios intentos | Reutilización de token Turnstile de un solo uso. | Turnstile obligatorio y reset tras cada fallo. |
| `SiteContent.heroTitle` no existe | Prisma/schema local adelantado a DB. | Fallback de lectura legacy y migración 006 aditiva; confirmar/aplicar migración antes de guardar. |
| Build/Prisma Client desactualizado | Cliente generado no versionado o proceso dev anterior. | `dev`, `build` y `postinstall` ejecutan `prisma generate`; reiniciar el proceso tras cambios de esquema. |
| Originales grandes no caben en Function | Límite de body Vercel. | Upload directo firmado a staging privado. |
| Riesgo de Data API | RLS inicialmente desactivado. | RLS habilitado sin políticas en negocio/seguridad. |
| Tentación de editar migración 002 | Existían tablas que demostraban que ya estaba aplicada. | Se consultó `_prisma_migrations`, se preservó y se creó 003. |
| Conexión directa dependía de IPv6 | Host DB directo puede no funcionar localmente. | Supavisor Session Pooler 5432 para CLI. |
| Crear bowl terminó en `StorageApiError` | Fallo al coordinar Storage/finalización; logs solo mostraban `bowls.create`. | La etapa posterior reforzó buckets, validación real, errores genéricos y workflow compensado. Si reaparece, revisar primero configuración MIME/límite de ambos buckets y evento Sentry; no exponer error del proveedor al cliente. |
| CSS nuevo no se veía | Un proceso Next dev antiguo servía un bundle CSS viejo. | Se comprobó CSS servido, se reinició dev y se verificó visualmente. En nueva máquina iniciar `npm run dev`; ante caché usar recarga forzada. |
| Sello del huevo sobre descripción en bloque de marca | Layout absoluto/anterior y además bundle viejo. | CSS actual usa tres columnas y sello estático en desktop; captura local confirmó separación. En mobile se reposiciona sobre el área visual. |
| Galería administrativa encimada | Jerarquía/espaciado iniciales. | Se ajustaron botones, layout y navegación; luego se compactó galería pública. |
| Reel no mostraba video | Solo se guarda enlace y miniatura. | Decisión explícita: miniatura enlazada; no embed ni video propio. |
| Advertencia schema de `vercel.json` en VS Code | URL del schema no marcada trusted. | Es una advertencia del editor, no error de Vercel; confiar dominio/workspace si se desea, sin alterar lógica. |
| Ruta temporal Sentry | Necesidad de verificar captura. | Se creó solo en desarrollo, se probó y se eliminó por completo. |

## 25. Tests existentes

Comando: `npm test`.

Última ejecución durante este handoff: **84/84 pasan**.

Archivos y cobertura:

- `tests/bowls.test.ts` (13): alta con SMALL/LARGE, tamaño faltante, precios,
  slug duplicado, bucket faltante, edición, estado, confirmación de borrado,
  autorización, reemplazo/rollback/cancelación de imagen.
- `tests/branches.test.ts` (13): siete días, faltantes/duplicados, horas,
  cerrados, edición, estado, confirmación, OWNER y visibilidad.
- `tests/promotions.test.ts` (16): datos, rechazo de formato legacy, días/franja,
  semántica informativa, compatibilidad con Prisma anterior, visibilidad,
  orden, edición/estado, OWNER, workflows de imagen y límites.
- `tests/content.test.ts` (5): contenido válido, hero obligatorio, WhatsApp,
  preservación de borrador ante error y OWNER activo.
- `tests/gallery.test.ts` (11): IMAGE/video, URL Instagram, orden, umbral y
  navegación de carrusel, estado, reemplazo/cancelación, publicación, enlace
  seguro y validación de miniaturas.
- `tests/public-navigation.test.ts` (10): presencia/ausencia de cada enlace y
  sección, promociones activas, coherencia href/section ID.
- `tests/security-and-images.test.ts` (16): HMAC, quinto fallo, expiración
  absoluta, mapeo HTTP, proxy vs handler, autorización en todos los handlers,
  bytes/formato/metadata, formatos/dimensiones/animados rechazados, 413,
  rate limit de imágenes, cleanup/idempotencia/finales, cron, sanitización
  Sentry y 500 genérico.

Faltan pruebas de integración end-to-end contra un entorno Supabase aislado;
no usar cuentas/datos reales para automatización.

## 26. Archivos y documentación importantes

- `AGENTS.md`: reglas obligatorias, stack, seguridad, flujo de trabajo y bloque
  de Next.js generado por `next dev`.
- `docs/PROJECT_CONTEXT.md`: memoria técnica viva y pendientes inmediatos.
- `docs/PROJECT_DOCUMENTATION.md`: guía operativa amplia.
- `docs/CODEX_HANDOFF.md`: este handoff.
- `docs/STORAGE_SECURITY.sql`: auditoría/políticas Storage manuales.
- `prisma/schema.prisma` y `prisma/migrations/**`: contrato y evolución DB.
- `.env.example`: nombres y placeholders seguros; sí se puede versionar porque
  no contiene valores reales.
- `lib/auth.ts`, `lib/security/**`, `proxy.ts`: autenticación/autorización.
- `lib/images/**`, `lib/supabase/storage-admin.ts`: Storage e imágenes.
- `lib/{bowls,branches,promotions,content,gallery}/**`: reglas de dominio.
- `lib/public-data.ts`, `lib/public-visibility.ts`: fuente pública y navegación.
- `sentry*.ts`, `instrumentation*.ts`, `lib/observability/**`: observabilidad.
- `app/api/internal/cleanup-temporary-images/route.ts`, `vercel.json`: cron.
- `brand-assets/README.MD`, `brand-assets/original/` si existe en la copia,
  `public/brand/logos/`, `src/assets/fonts/`: identidad visual obligatoria.
- `brand-assets/references/**`: inspiración organizada; no publicar mockups como
  fotos reales ni mover sin actualizar sus índices.
- `app/public.css`, `components/public/**`, `ClickSpark`, `CurvedLoop`: rediseño
  visual actual no committeado.
- De los efectos sugeridos de React Bits se incorporaron `ClickSpark` y
  `CurvedLoop` como código local auditado, sin nuevas dependencias runtime.
  `TextLoop` no se incorporó porque no había una secuencia real de contenido
  administrable que justificara el efecto; no agregarlo solo por decoración.

Nota: `brand-assets/README.MD` está versionado con extensión mayúscula, aunque
las reglas suelen referirse a `README.md`. En Windows no causa problema; en una
copia a filesystem case-sensitive verificar el nombre real.

## 27. Tareas completamente terminadas en código

- Base Next.js App Router, TypeScript estricto, Prisma server-only y Supabase.
- Página pública dinámica y navegación condicional.
- Login Supabase + OWNER activo + protección servidor de handlers.
- Turnstile, rate limit persistente y sesión administrativa doble.
- CRUD de bowls completo, incluidos estado, borrado confirmado e imágenes.
- CRUD de sucursales completo con siete horarios, estado y borrado confirmado.
- CRUD de promociones (alta/edición/estado, sin borrado por decisión).
- Contenido general singleton y metadata SEO.
- Galería de imágenes/miniaturas Instagram, estado, grilla/carrusel.
- Pipeline seguro de imágenes con formato preservado y workflow compensado.
- Endpoint y programación de cleanup; prueba local exitosa.
- Sentry server/edge/client con sanitización; prueba real exitosa y ruta
  temporal eliminada.
- Errores públicos genéricos y reporte controlado.
- 84 tests unitarios/de contrato pasando.
- Organización de referencias visuales y primer prototipo completo de rediseño
  público, aunque este último todavía no está committeado.

## 28. Tareas pendientes

Pendientes de infraestructura/datos:

1. Verificar de nuevo `_prisma_migrations` en Supabase y aplicar, solo con
   autorización, las tres pendientes: `20260801000300`, `20260804000100` y
   `20260804000200` (nombres completos en la sección 7).
2. Ajustar bucket `revuelto-temp` a 5 MB.
3. Ampliar MIME de `bucket-media` a JPEG/PNG/WebP.
4. Revisar/aplicar opcionalmente `STORAGE_SECURITY.sql` y volver a auditar
   políticas.
5. Confirmar variables de Vercel, desplegar cron y monitorizar primera ejecución.
6. Confirmar Sentry DSN por entorno sin agregar auth tokens al repositorio.
7. Crear pruebas de integración contra un Supabase aislado.

Pendientes de producto/diseño:

1. Continuar el ida y vuelta visual del frontend público.
2. Revisar responsive real en móvil/tablet/escritorio.
3. Ajustar si el usuario lo solicita: alturas de promociones/galería, escala de
   tipografía de sucursales y ritmo entre secciones.
4. Verificar que el sello del bloque “Hecho para resolver” siga separado en
   todos los breakpoints.
5. Decidir más adelante si la galería necesita video alojado/embed; hoy no.
6. Commit/push del rediseño y reorganización solo cuando el usuario lo pida y
   tras revisar el diff completo.

Pendientes documentales:

- README conserva alguna frase histórica que dice que promociones/contenido
  siguen pendientes; el código y la documentación técnica más nueva indican
  que ya están implementados. Actualizar README en una tarea futura autorizada.

## 29. Restricciones permanentes

### No modificar sin autorización explícita

- Cuentas Supabase Auth, contraseñas o usuarios reales.
- Migraciones ya aplicadas.
- Base remota mediante reset, `db push`, `migrate dev` o escrituras de
  diagnóstico.
- Buckets/RLS/políticas de Supabase automáticamente.
- Configuración real de Sentry o `sentry-sanitize.ts` sin una tarea específica.
- SVG originales internamente.
- Reglas de producto: receta fija, sin toppings, exactamente SMALL 25 oz y
  LARGE 35 oz.

### No aplicar automáticamente

- Migraciones.
- Seed contra datos reales.
- SQL de Storage.
- Deploy o push a GitHub.
- Creación/eliminación de buckets.
- Variables o secretos en Vercel/Supabase/Sentry/Turnstile.
- Registro público.

### No exponer al cliente

- `DATABASE_URL`, `DIRECT_URL`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- `SECURITY_HMAC_SECRET`.
- `TURNSTILE_SECRET_KEY`.
- `CRON_SECRET`.
- credenciales, tokens, cookies, JWT, refresh tokens, stack, SQL o errores
  internos.
- No importar Prisma en Client Components.

### Identidad visual obligatoria

- Antes de cambiar UI, leer `brand-assets/README.MD`, referencias relevantes,
  logos y fuentes.
- Paleta única: negro `#000000`, crema `#EFE5DA`, amarillo `#FFB300`, naranja
  `#ED6D2D`, rosa `#E1A1A1`, verde `#67CB8F`, celeste `#6EBBBE`.
- No inventar colores, logos, iconos, tipografías ni fotografías.
- Ohno Softie para interfaz; Revuelto Regular solo usos especiales.
- No deformar/recrear logos ni usar mockups como fotos de producto.

## 30. Último punto exacto y siguiente tarea recomendada

Último punto exacto:

- Se estaba iterando el rediseño visual público.
- El usuario pidió achicar levemente promociones y galería, agrandar datos de
  sucursal y evitar que el sello de huevo se superpusiera al texto del bloque
  azul “Hecho para resolver”.
- Los cambios sí existen en `app/public.css`, pero inicialmente no se veían
  porque un proceso `next dev` antiguo servía CSS viejo.
- Se reinició el servidor, se inspeccionó el CSS realmente servido y se tomó
  una captura a 1700×900. La captura confirmó:
  - bloque de marca en tres columnas;
  - sello estático a la derecha, sin superposición;
  - promociones y galería más compactas;
  - tipografía de sucursal aumentada.
- Después el proceso dev se cerró. Actualmente hay que ejecutar `npm run dev`
  en la nueva computadora y abrir `http://localhost:3000`.
- Ninguno de estos ajustes visuales fue pusheado.

Siguiente tarea recomendada:

1. Trasladar el directorio completo preservando cambios no committeados y
   recrear `.env.local` de forma segura.
2. Ejecutar `npm install` (dispara `prisma generate`).
3. Ejecutar `npm run dev` y verificar visualmente el frontend en desktop y
   mobile con datos existentes, especialmente sello/texto, promociones,
   galería y sucursales.
4. Antes de tocar código, leer este handoff, `AGENTS.md`,
   `PROJECT_CONTEXT.md`, la documentación Next 16 relevante y los assets de
   marca.
5. No aplicar migraciones todavía: primero consultar en modo read-only el
   estado real de `_prisma_migrations` y pedir autorización si faltan.
6. Continuar el ida y vuelta de diseño con el usuario. Cuando quede aprobado,
   revisar `git diff` completo (incluidos movimientos de referencias), ejecutar
   validaciones y recién entonces preguntar si desea commit/push.

## 31. Checklist de arranque seguro en la nueva computadora

```text
[ ] Copiar el working tree completo, incluidos archivos untracked.
[ ] No copiar node_modules ni .next como fuente de verdad.
[ ] Instalar Node/npm compatibles.
[ ] npm install
[ ] Recrear .env.local por canal seguro; nunca commit.
[ ] npm run prisma:validate
[ ] npm test
[ ] npm run lint
[ ] npx tsc --noEmit
[ ] npm run build
[ ] npm run dev
[ ] Revisar git status y comparar con la lista de cambios locales.
[ ] Verificar migraciones remotas en solo lectura antes de cualquier deploy.
```

Si el código, este handoff y el estado externo difieren, el orden de confianza
es: código local para comportamiento implementado; consulta de solo lectura a
Supabase/Vercel/Sentry para estado externo; después actualizar documentación.
Nunca “corregir” la discrepancia aplicando cambios destructivos por intuición.
