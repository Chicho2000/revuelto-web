# Revuelto — documentación técnica y operativa

Actualizada: 2026-08-19.

Este documento explica el estado real del repositorio, cómo operarlo y las
decisiones tomadas. No contiene secretos, contraseñas, tokens ni datos de
usuarios. Para el resumen vivo y los pendientes inmediatos, consultar también
[`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).

## Dedicación registrada

- Proyecto: Revuelto.
- Responsable que reporta la dedicación: Ciro Pregot.
- Trabajo acumulado informado antes de iniciar la ETAPA 2: **6 horas y 30 minutos**.
- Trabajo incorporado entre `dd71a77` y el commit actual verificado `40b93b1`: **aproximadamente 5 horas y 30 minutos**.
- Dedicación acumulada informada hasta esta actualización: **aproximadamente 12 horas**.

Este registro refleja el tiempo informado por Ciro para el alcance construido
hasta la fecha; las 5 horas y 30 minutos corresponden a los cambios incorporados
entre ambos commits. No es una estimación automática ni incluye trabajo futuro.

## Objetivo y alcance actual

Revuelto es una carta pública y un panel administrativo privado para un negocio
de bowls de huevos revueltos. El proyecto ya tiene base de datos, protección de
rutas, autenticación administrativa, controles de seguridad e infraestructura
de imágenes y CRUD de bowls, sucursales, promociones, contenido general, galería y merchandising.

| Área | Estado |
| --- | --- |
| Carta pública | Implementada, servida por Next.js y Prisma en servidor; menú y secciones dependen del contenido público visible. |
| Identidad visual | Implementada con assets y fuentes locales de la marca. |
| Login y autorización OWNER | Implementados. |
| Rate limiting y Turnstile | Implementados. |
| Sesión administrativa | Implementada: 30 min inactiva o 1 h absoluta. |
| Modelo Prisma y RLS | Implementados; seis migraciones aplicadas y la nueva migración aditiva de merchandising pendiente. |
| Storage y procesamiento de imágenes | Infraestructura implementada; buckets revisados y corregidos a 5 MB con JPEG/PNG/WebP. |
| CRUD de bowls | Implementado con dos tamaños, estado, imágenes seguras y borrado definitivo confirmado por nombre. |
| CRUD de sucursales y horarios | Implementado con siete días, estado, teléfono opcional y borrado definitivo confirmado por nombre. |
| CRUD de promociones | Implementado con fechas opcionales, estado e imágenes seguras; sin eliminación definitiva. |
| CRUD de contenido | Implementado con singleton estructurado, contacto, redes, footer y SEO. |
| Galería multimedia | Implementada con fotos y miniaturas enlazadas a Instagram; sin video alojado ni embeds. |
| Merchandising | Catálogo administrable implementado; migración pendiente, sin carrito, stock, variantes ni pagos. |

## Tecnologías

| Tecnología | Uso en el proyecto |
| --- | --- |
| Next.js App Router | Interfaz, Server Components, Route Handlers y proxy. |
| React y TypeScript estricto | Componentes y tipado. |
| Tailwind CSS | Estilos de la aplicación. |
| Prisma 7 + `@prisma/adapter-pg` | Acceso a PostgreSQL desde el servidor. |
| PostgreSQL en Supabase | Persistencia de negocio, seguridad y auditoría limitada. |
| Supabase Auth | Identidad, sesiones de autenticación y `signOut`. |
| Supabase Storage | Staging privado y entrega de imágenes procesadas. |
| Zod | Validación de variables y cuerpos de Route Handlers. |
| React Hook Form | Estado y validación de formularios administrativos complejos. |
| Cloudflare Turnstile | Verificación humana de cada login. |
| Sharp | Inspección y validación de imágenes sin transformación. |
| Sentry | Captura de errores sanitizada para servidor, edge y navegador. |
| ESLint, Node test runner y TSX | Calidad estática y pruebas unitarias. |
| Vercel | Despliegue previsto. |

No hay Express, registro público ni Prisma en componentes cliente.

La portada pública usa `app/public.css` para separar sus estilos del panel administrativo. `PublicHeader` recibe únicamente los enlaces derivados de `buildPublicNavigation`, incluido Merchandising cuando hay productos visibles; en mobile permite cierre por Escape y al seleccionar un destino. `RevealController` usa un único `IntersectionObserver`, se desactiva con `prefers-reduced-motion` y no impide que el HTML sea visible sin JavaScript. ClickSpark y CurvedLoop no se integraron para mantener el coste cliente y la composición del Hero acotados.

## Arquitectura

```text
Browser
  ├─ Carta pública ──────────────► Next.js Server Components ─► Prisma ─► PostgreSQL
  └─ Panel /admin
       ├─ Supabase Auth cookies ─► proxy.ts (sesión rápida)
       ├─ Páginas/handlers ──────► Auth + Prisma AdminUser OWNER/activo
       ├─ Login ────────────────► Turnstile + Supabase Auth + LoginAttempt
       └─ Imágenes ─────────────► URL firmada ─► revuelto-temp ─► Sharp ─► bucket-media
```

### Responsabilidades

- **Next.js:** renderiza UI, recibe operaciones administrativas y aplica el
  proxy de sesión. `proxy.ts` no decide roles.
- **Supabase Auth:** valida email/contraseña y mantiene sus cookies. La
  aplicación no crea, edita ni elimina usuarios Auth.
- **Prisma:** consulta los datos de negocio y `AdminUser`; se importa solo
  desde servidor.
- **Supabase Storage:** guarda staging y finales. La service role se restringe
  a `lib/supabase/storage-admin.ts` y nunca sale al navegador.
- **PostgreSQL/RLS:** las tablas de negocio y seguridad no exponen políticas a
  los roles Data API `anon` o `authenticated`; Prisma accede como servidor.

## Rutas

### Públicas

| Ruta | Propósito |
| --- | --- |
| `/` | Página pública con navegación condicional para Carta, Promociones, Sucursales, Galería y Merchandising. |
| `/admin/login` | Acceso administrativo; no debe redirigirse a sí misma. |

### Panel protegido

| Ruta | Estado |
| --- | --- |
| `/admin` | Resumen del panel. |
| `/admin/bowls` | Listado y administración de bowls. |
| `/admin/bowls/new` | Creación de bowl. |
| `/admin/bowls/[id]/edit` | Edición de bowl. |
| `/admin/promotions` | Listado, estado y administración de promociones. |
| `/admin/promotions/new` | Creación de promoción. |
| `/admin/promotions/[id]/edit` | Edición, fechas e imagen. |
| `/admin/branches` | Listado y administración de sucursales. |
| `/admin/branches/new` | Creación con siete horarios. |
| `/admin/branches/[id]/edit` | Edición de datos y horarios. |
| `/admin/content` | Edición del contenido general singleton. |
| `/admin/content/gallery` | Listado, orden y estado de la galería. |
| `/admin/content/gallery/new` | Alta de foto o miniatura enlazada a Instagram. |
| `/admin/content/gallery/[id]/edit` | Edición y reemplazo seguro de imagen. |
| `/admin/merchandise` | Listado, orden y estado del catálogo de merchandising. |
| `/admin/merchandise/new` | Creación de un producto con imagen obligatoria. |
| `/admin/merchandise/[id]/edit` | Edición y reemplazo seguro de imagen. |

### Route Handlers

| Método y ruta | Propósito |
| --- | --- |
| `POST /api/admin/login` | Verifica Turnstile, rate limit, Auth y autorización OWNER. |
| `POST /admin/logout` | Elimina actividad, cierra Supabase Auth y borra cookie administrativa. |
| `POST /admin/session/activity` | Renueva solo el vencimiento por inactividad. |
| `POST /admin/images/upload-intent` | Crea una autorización de staging para una imagen. |
| `POST /admin/images/complete` | Descarga y valida staging con Sharp sin transformarlo. |
| `POST /admin/images/discard` | Descarta un temporal al cancelar. |
| `POST /admin/bowls/manage` | Crea Bowl y SMALL/LARGE en una transacción. |
| `PUT /admin/bowls/manage/[id]` | Edita Bowl y hace upsert controlado de tamaños. |
| `DELETE /admin/bowls/manage/[id]` | Borra un bowl después de validar en servidor el nombre exacto. |
| `PATCH /admin/bowls/manage/[id]/status` | Activa o desactiva un bowl. |
| `POST /admin/branches/manage` | Crea Branch y siete BusinessHour de forma atómica. |
| `PUT /admin/branches/manage/[id]` | Edita Branch y hace upsert de los siete días. |
| `DELETE /admin/branches/manage/[id]` | Borra una sucursal después de validar en servidor el nombre exacto. |
| `PATCH /admin/branches/manage/[id]/status` | Activa o desactiva una sucursal. |
| `POST /admin/promotions/manage` | Crea una promoción y confirma su imagen opcional. |
| `PUT /admin/promotions/manage/[id]` | Edita datos, fechas y reemplazo/quita de imagen. |
| `PATCH /admin/promotions/manage/[id]/status` | Activa o desactiva sin borrar fechas ni imagen. |
| `PUT /admin/content/manage` | Valida y actualiza el singleton de contenido. |
| `POST /admin/content/gallery/manage` | Crea un elemento y confirma su imagen. |
| `PUT /admin/content/gallery/manage/[id]` | Edita el elemento y reemplaza su imagen de forma compensada. |
| `PATCH /admin/content/gallery/manage/[id]/status` | Activa o desactiva un elemento. |
| `POST /admin/merchandise/manage` | Crea un producto y confirma su imagen. |
| `PUT /admin/merchandise/manage/[id]` | Edita el producto y reemplaza su imagen de forma compensada. |
| `PATCH /admin/merchandise/manage/[id]/status` | Activa o desactiva un producto. |

Cada handler que consulta o modifica datos administrativos valida Supabase Auth,
`AdminUser`, `role = OWNER` e `isActive = true` en el servidor. Logout solo
destruye la sesión actual y no entrega datos administrativos.

## Navegación pública condicional

`getPublicSiteData` carga contenido, bowls, promociones, sucursales, galería y merchandising una sola vez en paralelo. En el servidor se forman las cinco colecciones `visible*`; después `buildPublicNavigation` deriva `hasBowls`, `hasPromotions`, `hasBranches`, `hasGallery` y `hasMerchandise`.

El mismo resultado construye `menuItems` y `sectionIds`, y `app/page.tsx` usa esos booleanos para renderizar las secciones. Merchandising exige un producto activo con `imagePath`; si no existe, no queda enlace, título, contenedor, espacio ni ancla. Las demás secciones conservan sus reglas previas.

Para una futura sección administrable se debe ampliar `selectVisiblePublicContent` y el descriptor de `buildPublicNavigation`. No debe agregarse un enlace estático por separado ni ocultarse la sección con CSS.

La suite `tests/public-navigation.test.ts` cubre los ocho contratos: ausencia/presencia de cada sección, promociones futuras/vencidas/inactivas y correspondencia completa entre cada `href` generado y los ids de sección derivados de la misma fuente.

## Base de datos y migraciones

### Modelos

| Modelo | Propósito |
| --- | --- |
| `AdminUser` | Relaciona UUID de Supabase Auth con el rol `OWNER` y su actividad. |
| `Bowl` | Receta fija y datos visibles del bowl. |
| `BowlSize` | Tamaños SMALL/LARGE, precio, huevos y disponibilidad. |
| `Branch` | Sucursal; el campo existente `whatsappNumber` respalda el teléfono opcional. |
| `BusinessHour` | Horario por día; cerrado implica horas nulas. |
| `Promotion` | Promoción, fechas opcionales e imagen. |
| `SiteContent` | Filas legacy más singleton estructurado reservado por `key = site-config`. |
| `GalleryItem` | Foto o miniatura de Instagram, enlace externo, orden y visibilidad. |
| `MerchandiseItem` | Producto de vidriera con nombre, descripción opcional, precio, imagen, estado y orden. |
| `LoginAttempt` | Límite durable de login por hashes de IP y email. |
| `AdminSessionActivity` | HMAC de sesión administrativa, actividad y vencimientos. |
| `TemporaryImage` | Estado y rutas server-generated de staging/procesamiento. |

Reglas de bowls: cada bowl tendrá exactamente SMALL (25 oz) y LARGE (35 oz)
en cada creación o edición mediante Zod y una transacción Prisma.
La base ya evita repetir un tamaño por bowl.

El borrado de bowl o sucursal es definitivo: la interfaz exige escribir exactamente el nombre y el Route Handler/servicio vuelve a comprobarlo antes de borrar. La cascada de Prisma elimina `BowlSize` al borrar su `Bowl` y `BusinessHour` al borrar su `Branch`.

Reglas de sucursales: Zod exige exactamente MONDAY–SUNDAY sin duplicados. Prisma
crea o actualiza Branch y los siete BusinessHour mediante nested writes atómicos,
y la restricción única `(branchId, dayOfWeek)` aporta defensa adicional. El campo
legado `mapsUrl` se inicializa vacío en nuevas sucursales porque esta etapa no
incorpora mapas; al editar se preserva cualquier valor existente.

Reglas de promociones: título y cuerpo son obligatorios; inicio y fin son opcionales y, si ambos existen, el fin debe ser posterior. `datetime-local` representa el horario de Argentina (UTC-03) y el servidor lo convierte a un instante UTC antes de Prisma. Al editar se vuelve a presentar mediante `America/Argentina/Buenos_Aires`. La visibilidad se decide en servidor y el orden público prioriza inicios más recientes, luego promociones sin inicio y finalmente `createdAt` descendente.

Contenido general usa la clave única reservada `site-config` como singleton activo. La migración conserva las filas legacy por clave y copia los valores de `hero` y `about` al crear el singleton. El formulario y el Route Handler comparten Zod; `heroTitle` es obligatorio y los valores opcionales vacíos se persisten como `NULL` sin reaparecer como defaults al recargar.

Galería ordena por `sortOrder` ascendente, luego `createdAt` e `id`. `INSTAGRAM_VIDEO` exige HTTPS, hostname exacto `instagram.com`, `www.instagram.com` o `m.instagram.com`, sin credenciales ni puerto, y ruta de publicación/Reel `p`, `reel`, `reels` o `tv`; se eliminan query y fragmento al normalizar. La tarjeta pública abre el destino con `target="_blank"` y `rel="noopener noreferrer"`. No se cargan videos, embeds ni scripts externos.

Cada alta o edición de galería se confirma solo con el botón Guardar de su propio formulario; no requiere guardar el contenido general. Hasta tres elementos públicos se muestran en grilla; desde cuatro se muestra un carrusel que avanza cada cinco segundos, se pausa al interactuar y ofrece anterior, siguiente e indicadores. Si la persona prefiere movimiento reducido, el avance automático queda desactivado.

### Estado de migraciones

| Migración | Estado | Contenido |
| --- | --- | --- |
| `20260801000000_init` | Aplicada | Esquema inicial, modelos de negocio y restricciones de bowls/promociones. |
| `20260801000100_enable_row_level_security` | Aplicada | Activa RLS sin políticas en tablas de negocio. |
| `20260801000200_admin_security_and_temporary_images` | Aplicada | Tablas de seguridad/imágenes, checks y RLS sin políticas. |
| `20260801000300_add_admin_session_absolute_expiry` | Aplicada | Agrega el vencimiento absoluto de una hora sin reescribir datos existentes. |
| `20260804000100_add_promotion_weekly_schedule` | Aplicada | Agrega días y franja horaria semanal a promociones. |
| `20260804000200_add_site_content_and_gallery` | Aplicada | Amplía `SiteContent`, crea el singleton y `GalleryItem`, agrega el destino de imagen y habilita RLS. |
| `20260819000100_add_merchandise` | Pendiente | Agrega `MERCHANDISE` al destino temporal, crea `MerchandiseItem`, su índice, check de precio positivo y RLS sin políticas. |

Antes de crear merchandising, `npx prisma migrate status` confirmó las seis
migraciones previas aplicadas. Después de crear la migración aditiva, Prisma
encontró siete migraciones y señaló únicamente `20260819000100_add_merchandise`
como no aplicada.
Nunca modificar una migración aplicada. La migración 003 calcula
`absoluteExpiresAt = createdAt + 1 hour` para las sesiones existentes antes de
marcar la columna como obligatoria.

Para consultar el estado sin aplicar cambios:

```bash
npx prisma migrate status
```

No usar `migrate deploy`, `migrate dev`, `db push` ni reset contra Supabase sin autorización.

## Autenticación, autorización y sesión

### Login

1. El formulario solicita email, contraseña y un token Turnstile desde el
   primer envío.
2. `POST /api/admin/login` calcula HMAC del email normalizado y de la IP.
3. Si el par IP/email está bloqueado, responde de forma genérica y no consulta
   Supabase Auth.
4. Verifica Turnstile en servidor, incluida la action `admin-login` y el
   hostname esperado.
5. Recién entonces llama a Supabase Auth con la contraseña. La contraseña no
   se persiste, registra ni hashea en la aplicación.
6. Busca `AdminUser` mediante Prisma y exige OWNER activo.
7. Si es válido, crea una cookie administrativa aleatoria y almacena solo su
   HMAC en `AdminSessionActivity`.

Una cuenta Auth sin OWNER activo se cierra inmediatamente y recibe la misma
respuesta genérica que una credencial incorrecta.

### Rate limiting

- Ventana: 15 minutos.
- Máximo: 5 fallos de credenciales o autorización.
- Bloqueo: 15 minutos desde el quinto fallo.
- Éxito: elimina el registro de `LoginAttempt` para ese par IP/email.
- Fallo de Turnstile, caída de red, timeout, base o proveedor: no incrementa.
- IP y email se almacenan solo como HMAC con `SECURITY_HMAC_SECRET`.

### Sesión administrativa

- La cookie `revuelto_admin_session` es HTTP-only, SameSite=Lax, `Path=/admin`
  y Secure en producción.
- Su valor es aleatorio; la base conserva solo un HMAC.
- Inactividad máxima: 30 minutos.
- Duración absoluta máxima: 1 hora desde el login.
- El navegador registra actividad relevante como máximo una vez por minuto.
- El servidor valida ambos vencimientos en cada acceso protegido; el cliente no
  es la única defensa.
- Logout borra el registro actual y ejecuta `supabase.auth.signOut()`.

### Sentry y errores públicos

Sentry captura fallos inesperados de servidor, edge y navegador. `sendDefaultPii`
está desactivado, no se guardan breadcrumbs ni trazas de performance y los hooks
`beforeSend`/`beforeSendTransaction` eliminan usuario, IP, request, URL, headers,
cookies, body, datos extra, contextos, mensajes, nombre de transacción y spans.
El evento conserva ubicaciones de stack y solo los tags controlados `area` y
`runtime`. El cliente recibe un mensaje genérico, nunca Prisma, SQL ni stack.

## Imágenes y Storage

### Buckets previstos

| Bucket | Visibilidad | Uso |
| --- | --- | --- |
| `revuelto-temp` | Privado | Staging y copias temporales validadas en su formato original. |
| `bucket-media` | Público de solo lectura | Imágenes finales validadas. |

No se conceden permisos directos de select/list/insert/update/delete a `anon` o
`authenticated`. La lectura pública de `bucket-media` usa la URL pública del
objeto. La service role se usa únicamente desde el servidor para Storage. El SQL
manual de auditoría y políticas restrictivas está en `docs/STORAGE_SECURITY.sql`.

Los buckets fueron revisados y corregidos manualmente: `revuelto-temp` es privado
y `bucket-media` es público para lectura; ambos limitan 5 MB y aceptan
JPEG/PNG/WebP. La aplicación conserva los archivos originales validados y no los
convierte automáticamente a WebP.

### Flujo

1. OWNER solicita intención indicando solo BOWL, PROMOTION, BRANCH o GALLERY.
2. El servidor genera ID, ruta de staging y URL firmada para un objeto concreto.
3. El browser sube directo a `revuelto-temp` para no atravesar el límite de
   cuerpo de una Function de Vercel.
4. El servidor descarga el original y revalida contenido real.
5. Sharp inspecciona formato, dimensiones y frames. Si cumple, se copian los bytes exactos; no hay resize, rotate, compresión, remoción de metadata ni conversión.
6. Los CRUD de bowls, promociones y galería preparan la copia final, persisten la base y luego confirman el temporal.
7. Promociones guarda finales bajo `promotions/{promotionId}/{uuid}.{jpg|png|webp}`; reemplazo y quita preservan la imagen anterior hasta actualizar la base.
8. Galería guarda finales bajo `gallery/{galleryItemId}/{uuid}.{jpg|png|webp}`; al reemplazar actualiza la base, confirma el temporal y recién entonces borra la imagen anterior.
9. Si algo falla, intenta borrar de inmediato y deja `CLEANUP_PENDING` para la
   futura tarea programada si no logra limpiar.

Límites de bowls, promociones, sucursales y galería: máximo 5 MB, 6000×6000,
24 MP, un frame/página y solo JPEG/PNG/WebP reales. Se rechazan SVG, GIF,
TIFF, BMP, HEIC, PDF, animados y cualquier imagen excedida. Un archivo mayor a
5 MB produce 413; el resto de los incumplimientos, 400. JPEG continúa JPEG, PNG
continúa PNG y WebP continúa WebP, con bytes, resolución y metadata intactos.

### Limpieza automática

`GET /api/internal/cleanup-temporary-images` exige `Authorization: Bearer
<CRON_SECRET>`. `vercel.json` lo ejecuta diariamente a las 03:00 UTC. Selecciona
solo registros no confirmados cuyo `expiresAt` ya pasó (24 horas), valida que
staging/temp pertenezcan a `staging/{ownerId}` o `temp/{ownerId}`, elimina esos
objetos y borra el registro con `deleteMany`. Si el registro ya tiene
`finalPath`, no borra el final: limpia temporales y lo marca `CONFIRMED`. Una
ruta ambigua queda `CLEANUP_PENDING`. Repetir el proceso es idempotente.
Los objetos que no tengan ningún registro `TemporaryImage` asociable no se
enumeran ni se borran automáticamente; deben auditarse manualmente para evitar
eliminar por error un recurso válido.

## Variables de entorno

Copiar `.env.example` a `.env.local`; nunca versionar valores reales.

| Variable | Tipo | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Privada | Supavisor Transaction Pooler 6543 para runtime. Incluye `pgbouncer=true` y `connection_limit=1`. |
| `DIRECT_URL` | Privada | Supavisor Session Pooler 5432 para Prisma CLI/migraciones. |
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública | Publishable Key de Supabase para Auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | Privada | Solo `lib/supabase/storage-admin.ts`. |
| `SECURITY_HMAC_SECRET` | Privada | HMAC de email, IP y sesión administrativa. |
| `TURNSTILE_SITE_KEY` | Pública por entrega controlada | La lee Server Component y la pasa como prop. |
| `TURNSTILE_SECRET_KEY` | Privada | Verificación Siteverify en servidor. |
| `TURNSTILE_EXPECTED_HOSTNAME` | Privada/configuración | Hostname que el servidor exige en la respuesta. |
| `CRON_SECRET` | Privada | Bearer aleatorio de 16+ caracteres para Vercel Cron; nunca `NEXT_PUBLIC`. |
| `SENTRY_DSN` | Privada | DSN usada por servidor y edge; configurada localmente sin documentar su valor. |
| `NEXT_PUBLIC_SENTRY_DSN` | Pública | DSN de ingesta para capturar errores del navegador; no es un token de cuenta. |

Ningún Client Component lee `process.env.TURNSTILE_SITE_KEY` directamente.

## Problemas encontrados y resolución

| Problema | Causa | Resolución |
| --- | --- | --- |
| Bucle en `/admin/login` | El layout protegido envolvía también el login. | Se separó el panel en `app/admin/(protected)`; `/admin/login` es público. |
| Login correcto rechazado con 4 fallos registrados | Turnstile emite tokens de un solo uso; el formulario reutilizaba el token del cuarto envío. | Turnstile ahora se exige siempre y se resetea tras toda respuesta fallida. |
| Vercel no admite originales de 10 MB por Route Handler | Límite de cuerpo de Functions. | Staging directo con URL firmada; el servidor descarga y valida después. |
| Riesgo de datos administrativos vía Data API | RLS desactivado en tablas. | RLS habilitado sin políticas para negocio y tablas de seguridad. |
| Migración aplicada modificada por error potencial | `LoginAttempt` existente indicaba que 002 ya estaba aplicada. | Se verificó `_prisma_migrations`, se preservó 002 y se creó 003 aditiva. |
| Conexión directa IPv6 no adecuada como estándar | `db.[PROJECT-REF]` puede exigir IPv6. | Documentación usa Supavisor Session Pooler 5432 para CLI. |
| Build sin Prisma Client generado | `generated/prisma` no se versiona. | `postinstall` ejecuta `prisma generate`. |

## Desarrollo, calidad y despliegue

### Requisitos y comandos

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
npx prisma validate
```

`postinstall` ejecuta `prisma generate`. El build y TypeScript deben pasar antes
de desplegar. Las 95 pruebas actuales validan los CRUD de bowls, sucursales, promociones, contenido y merchandising,
la galería, URLs de Instagram, imágenes, navegación pública condicional, HMAC/normalización,
bloqueo, límite absoluto de sesión e imágenes.

### Despliegue en Vercel

1. Configurar todas las variables privadas en Vercel, sin prefijo público.
2. Configurar las variables públicas de Supabase y la Site Key de Turnstile.
3. Aplicar migraciones revisadas desde un entorno autorizado antes del deploy
   que use el nuevo esquema.
4. Crear buckets y configurar Turnstile para hostnames de cada entorno.
5. Mantener `CRON_SECRET` configurado fuera de Git. `vercel.json` fue validado y registra el cron diario en producción.

## Próxima etapa

- Revisar y aplicar, solo con autorización explícita, `20260819000100_add_merchandise`.
- Probar manualmente el dashboard, merchandising y los ajustes visuales acotados de la home.
- Añadir pruebas de integración contra un entorno de prueba aislado.
- Continuar monitoreando las ejecuciones del cron de limpieza en Vercel.

## Mantenimiento documental

- `AGENTS.md`: reglas obligatorias para agentes y contribuciones.
- `PROJECT_CONTEXT.md`: memoria técnica concisa que se lee antes de tareas
  importantes y se actualiza al cambiar arquitectura, seguridad, datos,
  variables, rutas o flujos.
- Este documento: guía amplia para onboarding, operación y diagnóstico.

Si el código y esta documentación difieren, verificar primero el código y la
base de datos; luego actualizar ambos documentos sin alterar migraciones ya
aplicadas.
