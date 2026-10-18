# Revuelto — handoff técnico para continuar en otra computadora

Actualizado: 2026-10-18.

Este es el documento de traspaso operativo. Resume el estado real inspeccionado
del repositorio para que otra persona o agente pueda continuar sin reconstruir
el contexto desde el historial de conversación. No contiene secretos ni valores
de `.env.local`.

Fuentes de verdad complementarias:

- reglas obligatorias: [`../AGENTS.md`](../AGENTS.md);
- contexto técnico vivo: [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md);
- documentación técnica ampliada: [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md);
- historial detallado de Checkout Pro TEST: [`MERCADO_PAGO_DEBUGGING.md`](./MERCADO_PAGO_DEBUGGING.md);
- esquema efectivo: [`../prisma/schema.prisma`](../prisma/schema.prisma);
- variables esperadas, sin credenciales: [`../.env.example`](../.env.example).

## 1. Resumen ejecutivo

Revuelto es una web pública y un panel administrativo privado para un negocio de
bowls de huevos revueltos. La página pública muestra contenido real obtenido con
Prisma y permite armar un carrito de bowls y merchandising. El panel administra
carta, sucursales, contenido, promociones, galería y merchandising.

El repositorio está funcional y tiene controles server-side para autorización,
rate limiting, imágenes, secretos y errores. Los pedidos por WhatsApp están
implementados. Checkout Pro de Mercado Pago está implementado en modo TEST y un
pago de prueba real llegó a reconciliarse como aprobado, pero esa integración se
dejó **deliberadamente pausada** porque el negocio usará una cuenta definitiva o
nueva de Mercado Pago. No debe retomarse ni configurarse por iniciativa propia.

El próximo frente de producto es la nueva carta: seis bowls fijos, un bowl
personalizable y un único tamaño. Eso contradice el dominio actual, que exige
exactamente `SMALL` y `LARGE`. La siguiente instancia debe primero inspeccionar
el impacto y proponer alternativas de modelado; no debe empezar modificando el
schema o escondiendo botones.

Al comenzar esta documentación, el árbol de trabajo estaba limpio, la rama
local coincidía con su remota y la base informaba `Database schema is up to
date!`. Esta sesión documental no aplicó migraciones ni modificó configuración.

## 2. Estado de Git

Estado inspeccionado antes de editar este handoff:

| Dato | Valor |
| --- | --- |
| Rama | `integrate-rescue-design` |
| HEAD | `7696f9ea74a7b53603a8d05f3dd30343d5fded57` |
| Commit corto | `7696f9e` |
| Mensaje | `Documentacion de integracion y debugging de Mercado Pago` |
| Remoto de la rama | `origin/integrate-rescue-design` |
| Sincronización inicial | Local y remoto coincidían |
| Rama base | `main` / `origin/main` en `40b93b1` |
| Diferencia con `main` | 13 commits adelante, 0 atrás |
| Árbol inicial | Limpio |

El diff acumulado `main...integrate-rescue-design` comprende 74 archivos,
5.436 inserciones y 327 eliminaciones. Sus bloques principales son:

- recuperación del diseño público y merchandising;
- carrito y preparación segura de pedidos por WhatsApp;
- apertura diferenciada de WhatsApp en mobile y desktop;
- Checkout Pro TEST, webhook, reconciliación y pruebas;
- documentación y pruebas automatizadas.

Commits de la rama sobre `main`, del más reciente al más antiguo:

```text
7696f9e Documentacion de integracion y debugging de Mercado Pago
fedac2d Estoy cansado jefe (Corrige reconciliacion de pagos test de Mercado Pago)
de0decb Agrego diagnostico de ramas ignoradas de Mercado Pago
ec75741 Mejora al diagnostico de reconciliacion Mercado Pago
f8e7183 Agrego diagnostico de reconciliacion Mercado Pago
2ac6b0e Agrego diagnostico sanitizado al webhook de Mercado Pago
d039164 Correxion validacion de credenciales test de Mercado Pago
a2b4ce8 Agrego Checkout Pro de Mercado Pago en modo test
9f5599d Corrige apertura directa de WhatsApp en mobile
44daaf6 Corrige apertura de WhatsApp en mobile y desktop
ac17aa4 docs: update project status and work log
de16cc4 feat: add public WhatsApp ordering
6b5b0ab feat: integra merchandising y rediseño público
```

No asumir que `main` tiene estas funcionalidades. Antes de cualquier trabajo,
confirmar `git status --short --branch`, `git log -1 --oneline --decorate` y el
remoto correcto. No hacer merge, rebase, commit o push automáticamente.

## 3. Arquitectura actual

```text
Navegador
  ├─ página pública y carrito local
  ├─ formularios administrativos interactivos
  └─ Supabase Auth mediante handlers de la aplicación
          │
          ▼
Next.js App Router en Vercel
  ├─ Server Components por defecto
  ├─ Client Components acotados a interacción
  ├─ Route Handlers públicos y administrativos
  ├─ autorización OWNER server-side
  ├─ Prisma + adapter-pg, exclusivamente server-side
  ├─ Supabase Storage administrativo, exclusivamente server-side
  ├─ Sentry sanitizado
  └─ SDK de Mercado Pago, exclusivamente server-side
          │
          ├─ PostgreSQL/Supabase
          ├─ Supabase Auth
          ├─ Supabase Storage
          ├─ Turnstile
          ├─ WhatsApp
          └─ Mercado Pago TEST, actualmente pausado
```

No existe backend Express. `app/` contiene páginas y Route Handlers;
`components/` separa UI pública y administrativa; `lib/` concentra dominio,
seguridad e integraciones; `prisma/` contiene schema, migraciones y seed; y
`tests/` usa el runner nativo de Node mediante TSX.

Prisma no se importa en Client Components. Los componentes cliente nunca son
la barrera de seguridad: cada operación sensible vuelve a autenticar y autorizar
en servidor. La página pública no requiere autenticación y no existe registro
público.

## 4. Stack y versiones verificadas

Entorno local inspeccionado:

- Node.js `22.19.0`;
- npm `10.9.3`;
- lockfile npm versión 3.

Versiones instaladas/resueltas relevantes:

| Paquete | Versión |
| --- | --- |
| Next.js | `16.3.3` |
| React / React DOM | `19.2.4` |
| TypeScript | `5.9.3` |
| Tailwind CSS | `4.3.3` |
| Prisma / Prisma Client / adapter-pg | `7.9.1` |
| Supabase SSR | `0.12.3` |
| Supabase JS | `2.111.0` |
| Zod | `4.4.3` |
| React Hook Form | `7.84.0` |
| Mercado Pago SDK | `3.6.1` |
| Sentry para Next.js | `10.69.0` |
| Sharp | `0.35.4` |
| pg | `8.22.0` |
| ESLint | `9.39.5` |
| eslint-config-next | `16.3.0` |
| TSX | `4.23.1` |

`package.json` usa rangos para varias dependencias; `package-lock.json` es la
fuente reproducible. En una computadora nueva usar `npm ci`, no copiar
`node_modules` ni actualizar paquetes incidentalmente. El README acepta Node
`>=20.19`, pero Node 22 es la opción conservadora porque es el entorno aquí
verificado. `package.json` todavía no declara `engines`.

Scripts:

```text
npm run dev             prisma generate && next dev
npm run build           prisma generate && next build
npm start               next start
npm run lint            eslint
npm test                Node test runner + TSX
npm run prisma:generate prisma generate
npm run prisma:validate prisma validate
npm run prisma:seed     prisma db seed
```

`postinstall` ya ejecuta `prisma generate` después de `npm ci`.

## 5. Base de datos y modelos

PostgreSQL está alojado en Supabase y se accede mediante Prisma. Hay nueve
migraciones versionadas. El 2026-10-18 se ejecutó únicamente
`npx prisma migrate status` y Prisma respondió:

```text
Database schema is up to date!
```

No se aplicó ninguna migración. La salida real de Prisma es la fuente de verdad,
por encima de menciones históricas que puedan quedar en documentos antiguos.

Modelos actuales:

- `AdminUser`: autorización de usuarios administrativos de Supabase Auth;
- `LoginAttempt`: rate limit de login usando identificadores HMAC;
- `AdminSessionActivity`: sesión administrativa opaca, inactividad y vencimiento;
- `TemporaryImage`: ciclo de staging, validación, promoción y limpieza;
- `Bowl` y `BowlSize`: receta y sus tamaños obligatorios;
- `Branch` y `BusinessHour`: sucursales y horarios semanales;
- `Promotion`: promociones visibles configurables;
- `SiteContent`: singleton de textos, flags, contacto, redes y SEO;
- `GalleryItem`: imágenes públicas enlazables;
- `MerchandiseItem`: catálogo simple de merchandising;
- `PublicOrderRateLimit`: rate limit persistente de preparación de pedidos;
- `CheckoutOrder`: correlación y snapshot técnico de Checkout Pro.

El dominio de bowls actual es rígido:

- enum `BowlSizeType`: `SMALL` y `LARGE`;
- todo bowl debe tener exactamente ambos tamaños;
- `SMALL` representa 25 oz y `LARGE` 35 oz en los servicios actuales;
- precio, huevos, notas y disponibilidad viven por tamaño;
- formularios, página pública, carrito, mensajes, snapshots de pago y tests
  dependen de ese modelo.

`CheckoutOrder` guarda correlación técnica, estado del pago, IDs del proveedor,
importe y snapshot del pedido. No guarda números de tarjeta, CVV ni credenciales
de pago.

`prisma.config.ts` carga `.env.local`, usa `DIRECT_URL` para Prisma CLI, registra
las migraciones y configura el seed TypeScript. No ejecutar `migrate deploy`,
`migrate dev`, `db push`, `db seed` ni resets sin autorización explícita.

## 6. Panel administrativo y autenticación

Rutas principales:

- `/admin/login`: única pantalla administrativa pública;
- `/admin`: dashboard protegido;
- `/admin/bowls`, `/admin/branches`, `/admin/promotions`;
- `/admin/content`, incluida la galería;
- `/admin/merchandise`.

Supabase Auth valida identidad. Después, la aplicación exige un `AdminUser`
activo con rol `OWNER`. No hay registro público ni alta/baja automática de
usuarios Auth.

El proxy refresca sesión y resuelve navegación, pero no sustituye las
validaciones de los handlers. Las páginas, Route Handlers y acciones sensibles
usan autorización OWNER server-side. La sesión administrativa adicional usa
una cookie aleatoria `HttpOnly`, `SameSite=Lax`, `Path=/admin` y `Secure` en
producción. El servidor impone 30 minutos de inactividad o una hora absoluta,
lo que ocurra primero.

Login:

- Zod estricto para email, contraseña y Turnstile;
- email normalizado;
- IP/email persistidos solo como HMAC;
- cinco fallos relevantes en 15 minutos bloquean 15 minutos;
- Turnstile valida `admin-login` y el hostname exacto configurado;
- errores de infraestructura no cuentan como credenciales fallidas;
- una identidad sin OWNER activo se cierra inmediatamente.

El producto espera dos cuentas administradoras, pero el código **no impone una
cardinalidad exacta de dos**: autoriza cualquier fila `AdminUser` activa con rol
`OWNER`. No afirmar lo contrario ni crear usuarios sin autorización.

CRUD actual:

- bowls y sucursales: crear, editar, activar/desactivar y borrar con confirmación
  de nombre exacto;
- promociones, galería y merchandising: crear, editar y cambiar estado; no tienen
  borrado definitivo expuesto;
- contenido: edita el singleton de textos, pedidos, pagos, contacto, redes, footer
  y SEO.

## 7. Storage e imágenes

Buckets revisados manualmente:

| Bucket | Acceso | Límite | MIME permitidos |
| --- | --- | --- | --- |
| `revuelto-temp` | Privado | 5 MB | JPEG, PNG, WebP |
| `bucket-media` | Público para lectura | 5 MB | JPEG, PNG, WebP |

La aplicación no crea ni reconfigura buckets. `SUPABASE_SERVICE_ROLE_KEY` se lee
solo desde `lib/supabase/storage-admin.ts`, marcado server-only.

Flujo resumido:

1. un OWNER solicita una intención de carga;
2. el servidor crea una ruta de staging asociada al owner y una URL firmada;
3. el navegador sube directamente al objeto exacto autorizado;
4. el servidor descarga y valida archivo real, peso, formato, dimensiones,
   megapíxeles y cantidad de frames;
5. Sharp inspecciona pero no transforma;
6. se conservan bytes, formato y metadata originales de JPEG/PNG/WebP;
7. se copia a una ruta final controlada y se coordina el cambio con la base;
8. si algo falla, el workflow compensa sin borrar la imagen anterior válida.

Límites de aplicación: 5 MB, hasta 6000×6000, 24 MP y un frame/página. No se
convierten imágenes automáticamente a WebP. No modificar los SVG originales de
marca.

La intención es válida diez minutos y el registro temporal vence a las 24 horas.
El endpoint interno de cleanup, protegido con comparación timing-safe de
`CRON_SECRET`, procesa hasta 500 vencidos. `vercel.json` lo programa diariamente
a las 03:00 UTC. La auditoría previa comprobó 401 sin secreto o con secreto
incorrecto y cero candidatos en ese momento. El cleanup no debe ampliarse a
borrar objetos huérfanos o finales sin un análisis separado.

## 8. Web pública

`app/page.tsx` es un Server Component dinámico que obtiene datos reales. No hay
fallback permanente de mocks. `lib/public-data.ts` consulta los conjuntos y
`lib/public-visibility.ts` deriva visibilidad y navegación desde la misma fuente.

Secciones actuales:

- header sticky y navegación mobile accesible;
- Hero con assets de marca;
- carta de bowls;
- promociones;
- sucursales y horarios;
- merchandising;
- galería;
- bloque de marca, contacto, redes y footer.

Una sección y su enlace solo aparecen cuando existe contenido público válido.
Merchandising requiere producto activo e imagen. Galería usa grilla hasta tres
elementos y carrusel desde cuatro, con autoplay de cinco segundos, pausa por
hover/foco y respeto por `prefers-reduced-motion`. Un bowl sin foto muestra
`Foto próximamente`; esto es importante porque todavía no hay fotos finales de
la nueva carta.

Los estilos públicos viven principalmente en `app/public.css`; el panel conserva
su propia composición. `PublicHeader` y `RevealController` son los componentes
interactivos públicos relevantes. La identidad visual debe salir de
`brand-assets/README.MD`, `brand-assets/original/` si existe en la copia,
`public/brand/logos/` y `src/assets/fonts/`. No inventar colores, tipografías,
logos, íconos o fotografías.

Instagram oficial informado para incorporar o comprobar más adelante:

```text
Usuario: @revuelto.ok
URL: https://www.instagram.com/revuelto.ok?psln=MmxtN2o3cW4ycDJj
```

El código ya admite un campo editable de Instagram y lo usa en contenido/footer,
pero no se verificó desde esta sesión que ese valor exacto esté persistido en la
base. No ejecutar escrituras para comprobarlo.

## 9. Carrito, pedidos y WhatsApp

El carrito vive en `CartProvider`, se persiste en `localStorage` como
`revuelto-cart-v1` y guarda solamente tipo, ID de producto, tamaño y cantidad.
No guarda precios como fuente de verdad. Límites actuales: 20 unidades por línea,
50 unidades totales y 50 líneas; se rechazan líneas duplicadas malformadas.

`POST /api/orders/prepare`:

1. valida un body Zod estricto;
2. aplica rate limit persistente de 20 preparaciones cada 10 minutos por HMAC de
   IP;
3. vuelve a consultar `SiteContent`, bowls, tamaños, merchandising y sucursal;
4. comprueba visibilidad, disponibilidad y configuración;
5. recalcula todos los centavos en servidor;
6. construye un único mensaje y las URLs sobre el teléfono validado de la sucursal.

Nombres, precios, subtotales, total, teléfono y texto confiable no vienen del
navegador. Efectivo y transferencia cambian solo la línea correspondiente del
mensaje. El usuario conserva la capacidad normal de revisar o editar el texto ya
dentro de WhatsApp.

URLs para pedidos:

- mobile principal: `whatsapp://send?phone=...&text=...`;
- fallback mobile explícito: `https://wa.me/{phone}?text=...`;
- desktop: `https://web.whatsapp.com/send?phone=...&text=...`.

El mensaje se codifica una sola vez con `URLSearchParams` y conserva Unicode.
El cliente elige mobile/desktop mediante `navigator.userAgentData.mobile` y,
si no existe, un fallback de user-agent para Android/iPhone/iPad/iPod. El enlace
fallback aparece tras intentar la app; no se usa un timeout corto ni se abren
múltiples pestañas automáticamente.

No confundir este teléfono por sucursal con el botón flotante de contacto general,
que usa la configuración de `SiteContent`. Revuelto ofrece retiro por sucursal:
no hay delivery ni integración con PedidosYa.

## 10. Estado exacto de Mercado Pago

Checkout Pro está implementado técnicamente **solo para TEST**:

1. el cliente envía el mismo carrito validable y un UUID de idempotencia;
2. el servidor repite validación, rate limit, consulta y recálculo;
3. crea un `CheckoutOrder` con snapshot e importe ARS por 24 horas;
4. crea una preference con el SDK oficial y redirige al proveedor;
5. return page o webhook consultan el pago real mediante `Payment.get()`;
6. una reconciliación compartida correlaciona y persiste el estado;
7. WhatsApp de confirmación aparece solo para una orden realmente `APPROVED`.

Controles que deben permanecer:

- `MERCADO_PAGO_MODE=TEST` exacto;
- configuración de servidor válida;
- `CheckoutOrder` creado localmente;
- `external_reference` exacto;
- importe exacto para pagos aprobados;
- moneda `ARS`;
- Payment ID válido y no asociado a otra orden;
- estado leído con `Payment.get()`, nunca desde query params;
- idempotencia y protección contra regresiones de estado;
- firma `x-signature` del webhook, `x-request-id` y `data.id`;
- solo eventos `payment.created` y `payment.updated` y body limitado.

La validación ya no exige que una credencial TEST empiece con `TEST-`: Mercado
Pago entrega credenciales de prueba modernas con formato `APP_USR-...`. Tampoco
se usa `payment.live_mode === false` como bloqueo rígido. Una compra real hecha
en el entorno de prueba con cuentas de prueba y credenciales TEST devolvió
`live_mode=true`, aun cuando referencia, importe y moneda coincidían. El campo se
conserva como diagnóstico; la seguridad se apoya en modo explícito, credencial,
orden local, correlación, monto, moneda, unicidad y consulta real al proveedor.

Resultado manual comprobado: `Payment.get()` funcionó, una orden existente se
reconcilió como `APPROVED` y una repetición obtuvo el resultado idempotente
esperado. La historia completa y las causas descartadas están en
[`MERCADO_PAGO_DEBUGGING.md`](./MERCADO_PAGO_DEBUGGING.md).

Diagnósticos anteriores que no se deben repetir como soluciones nuevas:

- el simulador de webhook enviaba `data.id=123456`; era un ID ficticio y
  `Payment.get()` podía responder not found, correctamente sin aceptar el pago;
- la validación inicial exigía prefijo `TEST-`, pero las credenciales TEST
  actuales de Checkout Pro también pueden empezar con `APP_USR-`;
- un `await reconcileMercadoPagoPayment(...).catch(() => undefined)` ocultaba la
  causa de reconciliación; se reemplazó por manejo y logging sanitizado;
- el bloqueo rígido por `live_mode=false` ignoraba un pago TEST válido y fue
  reemplazado por las correlaciones server-side detalladas arriba.

Los logs granulares sanitizados `MP_WEBHOOK_*`, `MP_RETURN_*` y
`MP_RECONCILE_*` siguen presentes. No incluyen tokens, secretos, cookies,
authorization ni payloads completos, pero deben reducirse cuando termine la
validación funcional.

## 11. Mercado Pago: pausa y pendientes

La integración queda pausada porque el negocio va a recibir la cuenta definitiva
o una nueva cuenta de Mercado Pago. En el `.env.local` inspeccionado por nombre,
sin leer ni exponer valores, no estaban definidas las cinco variables de Mercado
Pago. Esto es coherente con la pausa: el código existe, pero el flujo no está
disponible en ese entorno local.

No retomar, reconfigurar, migrar a producción ni volver a probar pagos salvo
pedido explícito. En particular, no basta con cambiar un token: `lib/env.ts`
bloquea cualquier modo distinto de `TEST`; producción requiere una decisión y
revisión separadas.

Cuando el usuario decida retomarlo:

1. confirmar cuál es la aplicación/cuenta Seller definitiva;
2. crear usuarios o credenciales de prueba desde esa cuenta según la guía vigente;
3. configurar variables TEST en local y Preview sin imprimirlas;
4. registrar la URL de webhook de la Preview y su secret correcto;
5. comprobar `APP_BASE_URL` exacta y pública;
6. revisar Vercel Protection y el bypass del webhook sin exponerlo;
7. repetir la matriz controlada indicada abajo;
8. reducir logs temporales después de cerrar el diagnóstico;
9. diseñar producción explícitamente, con credenciales y deployment separados.

Matriz que quedó pendiente antes de declarar cerrada la integración:

1. aprobado completo hasta WhatsApp;
2. idempotencia y refrescos;
3. pago rechazado;
4. pago pendiente;
5. checkout abandonado;
6. webhook con un Payment ID TEST real;
7. webhook repetido e idempotente;
8. navegación back/refresh;
9. estado del carrito después de cada resultado;
10. limpieza/reducción de logs temporales.

El pago aprobado y una reconciliación repetida ya probaron partes importantes de
los puntos 1 y 2, pero no se debe dar por completada toda la matriz ni la salida
a producción con la futura cuenta a partir de un único caso.

No aceptar IDs simulados como pagos, no omitir `Payment.get()`, no confiar en
`status=approved` del retorno y no actualizar manualmente una orden para hacer
pasar una prueba.

## 12. Próximo producto: nueva carta

Esta información está acordada como dirección de producto, pero todavía **no
está modelada ni implementada**.

### Bowls fijos

1. **Horneado**: huevos revueltos, pollo macerado, calabaza asada, repollo,
   zanahorias y cebolla morada horneadas, pimientos asados y maní tostado. Salsa:
   tzatziki.
2. **Agridulce**: huevos revueltos, pollo macerado, panceta crocante, calabaza asada, pepinos
   agridulces, palta cremosa y almendras tostadas. Salsa agridulce de zanahoria y
   jengibre.
3. **Gramajo**: huevos revueltos, jamón cocido salteado, queso, panceta crocante, cebolla
   caramelizada, papas pay y cebollita encurtida. Salsa de Dijon, miel, limón y
   yogur; falta definir un nombre comercial breve.
4. **Portobello**: huevos revueltos, pollo macerado, portobellos salteados, cherry confitado,
   ceviche de zucchini y semillas de girasol garrapiñadas. Salsa de zanahoria y
   jengibre.
5. **Vegetariano**: huevos revueltos, calabaza asada, brócoli salteado, cherry confitado,
   zanahorias y pimientos al horno, portobellos salteados y semillas de girasol
   garrapiñadas. Salsa de soja, naranja y jengibre.
6. **Desayuno/Merienda**: huevos revueltos, elección real entre panceta crocante
   **o** jamón salteado, queso, palta cremosa, cherrys y maní tostado.

### Bowl personalizable

- base fija: huevos revueltos;
- proteína: exactamente una entre pollo macerado, jamón o panceta crocante; no usar pollo
  desmenuzado;
- vegetales: hasta cuatro entre calabaza asada, repollo, cebolla, zanahoria, pimientos,
  brócoli, portobello/hongo por definir, cherry, pepino agridulce/encurtido,
  cebolla caramelizada, arvejas, palta cremosa y ceviche de zucchini/vegetal por
  definir;
- semillas/frutos secos: exactamente uno entre maní, almendras, semillas/frutos
  secos garrapiñados y sésamo si se conserva; los garrapiñados pertenecen a esta
  categoría, no a vegetales;
- salsa: exactamente una entre tzatziki, agridulce de zanahoria y jengibre,
  Dijon/miel/limón/yogur y soja/naranja/jengibre.

### Tamaño y precio

La nueva carta usa **un solo tamaño**. El recipiente previsto es de 20 oz, pero
falta decidir si ese volumen debe mostrarse de forma destacada al cliente. Los
precios todavía no son el foco, aunque el sistema actual exige precios positivos
para ambos tamaños. Tampoco hay fotografías finales; usar el placeholder actual,
no inventar imágenes.

### Por qué requiere diseño previo

No alcanza con ocultar botones `SMALL`/`LARGE`. Hoy el tamaño atraviesa:

- `BowlSizeType`, `BowlSize` y migraciones;
- schemas y servicio de bowls;
- formulario administrativo, que exige dos precios positivos;
- render público y botones de agregado;
- esquema de líneas de carrito y clave de deduplicación;
- validación y resolución server-side del pedido;
- mensaje de WhatsApp;
- snapshot, títulos y reconciliación de Mercado Pago;
- tests de bowls, pedidos y Mercado Pago.

Tampoco existen entidades para ingredientes, categorías, límites o selecciones
personalizadas. El primer trabajo debe ser un análisis de opciones con impacto en
datos existentes, UX administrativa, compatibilidad del carrito y migración. No
crear dos sistemas paralelos ni codificar ingredientes únicamente en el cliente.

## 13. Riesgos y deuda técnica

- La rama contiene 13 commits que aún no están en `main`; verificar estrategia de
  integración antes de abrir trabajo concurrente.
- La nueva carta contradice la invariancia de dos tamaños y necesita migración de
  dominio, datos, formularios, carrito, pedidos y tests.
- El personalizable no tiene modelo de ingredientes ni snapshot específico.
- Mercado Pago está en pausa; reactivarlo con una cuenta distinta exige volver a
  configurar y validar el entorno TEST.
- Los logs diagnósticos de Mercado Pago son intencionalmente verbosos y deben
  reducirse al cerrar esa integración.
- `README.md` conserva descripciones históricas de Mercado Pago y setup que pueden
  estar por detrás de este handoff; no usarlo como única fuente de verdad.
- El texto de ayuda del panel todavía puede decir que Mercado Pago no está
  conectado, aunque el flujo TEST fue implementado y luego pausado.
- El requisito de “dos administradores” es organizativo, no una restricción de
  cardinalidad en base de datos.
- El valor oficial de Instagram existe en el código como campo configurable, pero
  no se verificó su valor persistido.
- La auditoría de dependencias mencionada en documentación anterior es histórica;
  volver a ejecutar `npm audit` antes de tomar decisiones y no usar
  `npm audit fix --force` automáticamente.
- La instalación local inspeccionada mostraba algunos paquetes WASM/Sharp
  extraneous. No copiar ese `node_modules`; `npm ci` debe recrearlo desde lockfile.
- La aplicación es un flujo de retiro y contacto: no hay POS, backoffice de
  pedidos, delivery ni integración con PedidosYa.

## 14. Variables de entorno

Nombres esperados:

| Variable | Ámbito | Propósito |
| --- | --- | --- |
| `DATABASE_URL` | Servidor | Runtime Prisma; Supavisor Transaction Pooler 6543 |
| `DIRECT_URL` | CLI/servidor | Prisma CLI; Supavisor Session Pooler 5432 |
| `NEXT_PUBLIC_SUPABASE_URL` | Público | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Público | Cliente Supabase permitido |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor secreto | Administración de Storage solamente |
| `SECURITY_HMAC_SECRET` | Servidor secreto | HMAC de seguridad y sesión administrativa |
| `TURNSTILE_SITE_KEY` | Público | Widget de login |
| `TURNSTILE_SECRET_KEY` | Servidor secreto | Siteverify |
| `TURNSTILE_EXPECTED_HOSTNAME` | Servidor | Host permitido en login |
| `CRON_SECRET` | Servidor secreto | Protege cleanup interno |
| `SENTRY_DSN` | Servidor | Ingesta Sentry server/edge |
| `NEXT_PUBLIC_SENTRY_DSN` | Público | Ingesta Sentry browser |
| `MERCADO_PAGO_MODE` | Servidor | Solo acepta `TEST` en el código actual |
| `MERCADO_PAGO_ACCESS_TOKEN` | Servidor secreto | SDK y Payment API TEST |
| `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` | Público | Declarada, no usada por el redirect actual |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Servidor secreto | Firma del webhook |
| `APP_BASE_URL` | Servidor | URL HTTPS exacta del deployment |

Estado de `.env.local` inspeccionado solo por presencia de nombres, sin mostrar
valores:

- estaban presentes las variables esperadas de base, Supabase, seguridad,
  Turnstile, cron y Sentry;
- no estaban presentes `MERCADO_PAGO_MODE`, `MERCADO_PAGO_ACCESS_TOKEN`,
  `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET` ni
  `APP_BASE_URL`;
- no se modificó el archivo.

`NODE_ENV` y `NEXT_RUNTIME` son variables administradas por el framework, no
requisitos manuales del `.env.local`. Nunca copiar valores a documentación,
issues, commits, logs o chats. El DSN público de Sentry es un identificador de
ingesta, pero tampoco hace falta duplicarlo en docs.

En Vercel, los mismos nombres pueden tener valores distintos por Development,
Preview y Production. La configuración de Supabase, hostname de Turnstile,
Sentry y `APP_BASE_URL` debe corresponder al deployment. Mercado Pago debe
permanecer ausente o en TEST en Preview mientras siga pausado; el código actual
no admite una activación Production y no debe improvisarse mediante variables.

## 15. Checklist para una computadora nueva

1. Instalar Git, Node 22 LTS/compatible y npm.
2. Clonar el repositorio y hacer checkout de `integrate-rescue-design`.
3. Ejecutar `git status --short --branch` y confirmar el commit esperado con
   `git log -1 --oneline --decorate`.
4. Leer completos `AGENTS.md`, este handoff, `PROJECT_CONTEXT.md` y
   `PROJECT_DOCUMENTATION.md`.
5. No copiar `node_modules`, `.next`, `generated/prisma`, `.vercel` ni builds.
6. Crear `.env.local` de forma segura a partir de `.env.example`, obteniendo los
   valores de sus proveedores; no recuperarlos desde Git o documentación.
7. Mientras Mercado Pago siga pausado, no inventar sus variables. Aceptar que sus
   acciones no estarán disponibles localmente.
8. Ejecutar `npm ci`. `postinstall` generará Prisma Client.
9. Ejecutar `npx prisma validate`.
10. Ejecutar `npx prisma migrate status` y tomar esa salida como verdad. No aplicar
    migraciones sin autorización.
11. Ejecutar `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` y
    `git diff --check`.
12. Confirmar que las validaciones no hayan creado cambios versionables
    inesperados con `git status --short`.
13. Iniciar con `npm run dev` solo después de las validaciones.
14. Probar login y rutas públicas sin imprimir cookies, tokens o URLs sensibles.
15. Para datos o servicios remotos, usar Preview/TEST y seguir las autorizaciones
    del usuario. Nunca resetear ni sembrar la base por conveniencia.

## 16. Archivos prioritarios

### Imprescindibles

| Ruta | Contenido y motivo de lectura |
| --- | --- |
| `AGENTS.md` | Reglas obligatorias de arquitectura, seguridad, marca y trabajo. |
| `docs/CODEX_HANDOFF.md` | Estado de continuidad, pausas y próximo alcance. |
| `docs/PROJECT_CONTEXT.md` | Contexto vivo y decisiones acumuladas. |
| `package.json` y `package-lock.json` | Scripts y dependencias reproducibles. |
| `.env.example` | Contrato de variables sin valores reales. |
| `prisma/schema.prisma` | Dominio persistido e invariantes actuales. |
| `prisma/migrations/**` | Historia real del esquema; no reemplaza `migrate status`. |
| `app/page.tsx` | Composición y datos de la web pública. |
| `lib/public-data.ts` y `lib/public-visibility.ts` | Consultas y visibilidad/navegación condicional. |
| `lib/auth.ts`, `lib/security/**`, `lib/supabase/**` | Límites de confianza, OWNER, sesiones, rate limits y proveedores. |

### Importantes

| Ruta | Contenido y motivo de lectura |
| --- | --- |
| `docs/PROJECT_DOCUMENTATION.md` | Operación y arquitectura ampliadas. |
| `app/public.css` y `app/globals.css` | Separación visual pública/global. |
| `components/public/**` | Header, galería, carrito y acciones interactivas. |
| `app/admin/**` y `components/admin/**` | Páginas, handlers y formularios del panel. |
| `lib/images/**` y `lib/supabase/storage-admin.ts` | Pipeline seguro de originales y temporales. |
| `lib/content/**`, `lib/gallery/**`, `lib/merchandise/**` | Dominios editables de contenido público. |
| `vercel.json` | Programación del cleanup en despliegue. |
| `tests/**` | Contratos ejecutables y regresiones de todos los dominios. |

### Solo si tocamos Mercado Pago

| Ruta | Contenido y motivo de lectura |
| --- | --- |
| `docs/MERCADO_PAGO_DEBUGGING.md` | Cronología, evidencia real y decisiones de seguridad. |
| `lib/mercado-pago/**` | Gateway, dominio, repositorio y reconciliación compartida. |
| `app/api/orders/mercado-pago/**` | Creación y consulta del checkout. |
| `app/api/webhooks/mercado-pago/route.ts` | Entrada firmada y política de respuestas. |
| `app/checkout/mercado-pago/**` | Success/pending/failure y reconciliación de retorno. |
| `lib/env.ts` | Bloqueo explícito de configuración TEST. |
| `tests/mercado-pago.test.ts` | Casos de correlación, estados, idempotencia y Unicode. |
| Migración/modelo `CheckoutOrder` | Persistencia y snapshot de órdenes técnicas. |

### Solo si tocamos el nuevo menú

| Ruta | Contenido y motivo de lectura |
| --- | --- |
| `lib/bowls/schema.ts` | Zod actual que exige dos tamaños. |
| `lib/bowls/service.ts` y `lib/bowls/workflow.ts` | Writes, precios, tamaños e imágenes. |
| `components/admin/bowls/bowl-form.tsx` | UX administrativa de SMALL/LARGE. |
| `app/admin/(protected)/bowls/**` y `app/admin/bowls/manage/**` | Páginas y endpoints de la carta. |
| `components/public/order/cart-provider.tsx` | Persistencia, clave y estado de cada línea. |
| `lib/orders/cart.ts`, `lib/orders/schema.ts`, `lib/orders/service.ts` | Límites, validación y recálculo server-side. |
| `lib/orders/whatsapp.ts` | Serialización del pedido validado. |
| `app/page.tsx` | Presentación y botones de tamaños. |
| `lib/mercado-pago/types.ts`, `domain.ts`, `checkout.ts` | Snapshot y títulos que hoy incluyen tamaño/oz. |
| `tests/bowls.test.ts`, `tests/orders.test.ts`, `tests/mercado-pago.test.ts` | Contratos afectados por tamaño y personalización. |

Para el próximo objetivo, leer todo el recorrido Bowl → carrito → pedido →
snapshot de pago. Una modificación aislada en UI dejaría invariantes server-side
incompatibles.

## 17. Qué no hacer

- No hacer push, merge, rebase, cherry-pick o commit sin pedido.
- No aplicar migraciones, `db push`, seed, reset ni cambios manuales de DB sin
  autorización.
- No reactivar Mercado Pago ni configurar credenciales por iniciativa propia.
- No confiar en query params de Mercado Pago ni quitar `Payment.get()`.
- No eliminar validaciones de referencia, monto, moneda, unicidad o idempotencia.
- No exponer tokens, service role, secrets, cookies, headers o URLs sensibles.
- No importar Prisma o SDKs privados en Client Components.
- No crear registro público ni confiar solo en el proxy/UI para administración.
- No cambiar buckets, RLS, Auth, usuarios, Sentry, cron o seguridad como efecto
  colateral de la nueva carta.
- No resolver el tamaño único ocultando `SMALL` y `LARGE` solo visualmente.
- No hardcodear ingredientes o precios únicamente en el cliente.
- No inventar fotos, logos, colores, tipografías o íconos.
- No convertir automáticamente originales a WebP.
- No agregar delivery, PedidosYa o un sistema interno de pedidos sin nuevo alcance.
- No ejecutar correcciones destructivas de npm ni actualizar el lockfile de forma
  incidental.

## 18. Primer objetivo recomendado

Preparar una propuesta técnica, sin implementar, para migrar desde bowls con dos
tamaños fijos a:

- seis recetas fijas;
- un bowl personalizable con categorías y límites server-side;
- un único tamaño;
- compatibilidad clara con carrito, WhatsApp y el snapshot de Checkout Pro;
- estrategia explícita para datos existentes y panel administrativo.

La propuesta debería comparar al menos:

1. mantener `BowlSize` como variante única genérica frente a eliminarlo;
2. normalizar ingredientes/categorías/opciones frente a snapshots JSON
   versionados;
3. cómo representar la elección bacon/jamón del bowl Desayuno/Merienda;
4. cómo guardar selecciones personalizadas en carrito y snapshot sin confiar en
   nombres/precios del cliente;
5. cómo migrar bowls actuales sin perder datos ni romper pedidos ya existentes;
6. cómo tratar precio durante la etapa editorial en la que todavía no está
   definido;
7. impacto exacto en Prisma, admin, público, pedidos, Mercado Pago y tests.

Antes de editar, presentar opciones, riesgos, migración y lista de archivos. La
implementación debe esperar aprobación.

## 19. Preguntas e inconsistencias abiertas

1. ¿El recipiente de 20 oz debe mostrarse al público o quedar como dato interno?
2. ¿Cuál será el nombre comercial corto de la salsa Dijon/miel/limón/yogur?
3. ¿La opción “portobello/hongo” del personalizable será una sola opción o dos?
4. ¿Se mantiene el ceviche de zucchini tal cual o se define otro vegetal?
5. ¿Se mantiene el sésamo entre semillas/frutos secos?
6. ¿Cómo se fijará el precio único y qué debe permitir el admin antes de tenerlo?
7. ¿Los ingredientes requieren disponibilidad y precio extra individual, o solo
   límites y selección?
8. ¿El bowl Desayuno/Merienda se considera receta fija con una elección obligatoria
   o una variante especial del personalizable?
9. ¿Se deben conservar bowls actuales como históricos/inactivos al migrar?
10. ¿El usuario oficial de Instagram ya está cargado en `SiteContent` remoto?
11. ¿Cuándo estará disponible la cuenta definitiva de Mercado Pago y qué
    deployment se usará para reiniciar las pruebas?
12. ¿La rama `integrate-rescue-design` se integrará a `main` antes o después del
    rediseño de la carta?
13. `README.md` y algunos textos del admin describen Mercado Pago como pendiente;
    ¿se actualizan ahora a “TEST validado y pausado” o al retomar la cuenta final?

## Prompt para el agente de la nueva computadora

Copiar y pegar este bloque como primer mensaje en la nueva instancia:

```text
Voy a continuar el proyecto Revuelto desde esta computadora.

Antes de hacer cualquier cambio, leé completamente:
- AGENTS.md
- docs/CODEX_HANDOFF.md
- docs/PROJECT_CONTEXT.md
- docs/PROJECT_DOCUMENTATION.md
- docs/MERCADO_PAGO_DEBUGGING.md solo si necesitás contexto de pagos

Después inspeccioná el repositorio real y confirmá:
- rama, HEAD, remoto y git status;
- versiones de Node/npm y dependencias instaladas;
- resultado de npx prisma migrate status, sin aplicar migraciones;
- presencia por nombre de las variables requeridas, sin mostrar valores;
- cualquier discrepancia entre los documentos y el código.

Reportame esas inconsistencias y resumime qué entendés del estado actual antes de
proponer cambios.

Mercado Pago Checkout Pro TEST está implementado y tuvo una reconciliación real
aprobada, pero queda deliberadamente PAUSADO hasta recibir la cuenta definitiva o
nueva del negocio. No lo reactives, no configures credenciales, no hagas pagos y
no cambies su seguridad salvo que yo lo solicite expresamente.

El próximo objetivo es analizar la nueva carta de seis bowls fijos, un bowl
personalizable y un único tamaño. El modelo actual exige SMALL y LARGE en Prisma,
admin, público, carrito, WhatsApp, snapshot de Mercado Pago y tests. No implementes
todavía y no ocultes los dos tamaños solo en UI. Primero presentame alternativas de
arquitectura, impacto, estrategia de migración, riesgos, preguntas abiertas y los
archivos que cambiarían. Esperá mi aprobación antes de modificar. No inventes
fotos, precios ni ingredientes.

No hagas commit ni push. No apliques migraciones. No modifiques Auth, usuarios,
Storage, Sentry, Cron, seguridad ni datos remotos. Usá el código y el resultado
real de Prisma como fuente de verdad cuando contradigan documentación histórica.
```
