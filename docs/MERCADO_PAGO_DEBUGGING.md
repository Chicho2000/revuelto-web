# Mercado Pago Checkout Pro: diagnóstico de credenciales TEST, webhook y reconciliación

Actualizado: 2026-09-12.

Este documento registra la incidencia investigada en la rama
`integrate-rescue-design`, desde la implementación inicial de Checkout Pro TEST
hasta la reconciliación correcta e idempotente de un pago real. No contiene
Access Tokens, Webhook Secrets, datos de tarjeta, credenciales del comprador ni
valores de Vercel Protection Bypass.

## Resumen ejecutivo

Un pago real creado con la configuración TEST de Revuelto era obtenido
correctamente mediante `Payment.get()`, pero permanecía `PENDING` porque la
reconciliación exigía `payment.liveMode === false`. Mercado Pago devolvió
`live_mode=true` para ese pago TEST válido, por lo que la función retornaba
`IGNORED` antes de asociar el Payment ID o actualizar `CheckoutOrder`.

La corrección eliminó `live_mode` como bloqueo rígido, no como dato diagnóstico.
La separación de ambiente continúa limitada a `MERCADO_PAGO_MODE=TEST`, una
credencial TEST configurada deliberadamente en Preview y la validación
server-side completa de pago, orden, referencia, importe, moneda, propiedad del
Payment ID, estado del proveedor e idempotencia. Return page y webhook utilizan
la misma política de reconciliación.

## Flujo esperado

```text
carrito público
→ selección de sucursal
→ selección de Mercado Pago
→ creación server-side de CheckoutOrder
→ creación server-side de Preference
→ pago en Checkout Pro
→ retorno o webhook hacia Revuelto
→ Payment.get(paymentId)
→ correlación y validación server-side
→ actualización idempotente de CheckoutOrder
→ UI “Pago confirmado” solo si la base quedó APPROVED
→ WhatsApp habilitado desde el snapshot confiable
```

El navegador no es fuente de verdad para nombres, precios, subtotales, total ni
estado del pago. Tampoco se confía en `status=approved`, `collection_status`,
`preference_id` u otros parámetros de la back URL. Esos parámetros sirven como
pistas de retorno; el estado aceptado siempre proviene de `Payment.get()` y queda
persistido antes de modificar la UI.

## Cronología del problema

### 1. Primer 503: configuración rechazada antes de llamar al proveedor

El simulador de Mercado Pago enviaba un evento `payment.updated` con
`data.id=123456`, y Vercel respondía 503. Los primeros registros mostraban una
invocación muy breve y ninguna salida HTTP. Se revisaron:

- `MERCADO_PAGO_MODE`;
- `MERCADO_PAGO_ACCESS_TOKEN`;
- `MERCADO_PAGO_WEBHOOK_SECRET`;
- `APP_BASE_URL`;
- Vercel Preview Protection y su bypass para automatizaciones;
- existencia y ejecución del Route Handler.

La primera causa fue local: `lib/env.ts` exigía que todo Access Token TEST
comenzara con `TEST-`. La credencial de prueba entregada por Mercado Pago para
esta integración comenzaba con `APP_USR-`, así que
`getMercadoPagoEnvironment()` consideraba inválida la configuración y devolvía
503 antes de construir el SDK o ejecutar una request externa.

### 2. Credencial TEST con prefijo `APP_USR`

La documentación actual de Mercado Pago indica que las credenciales de prueba
de Checkout Pro se crean automáticamente y que el Access Token de prueba puede
tener prefijo `APP_USR`, al igual que una credencial productiva. Por eso se
eliminó la inferencia de ambiente por prefijo.

La validación quedó estructural: token presente, no vacío después de `trim` y
con longitud mínima razonable. La señal explícita que habilita esta etapa sigue
siendo `MERCADO_PAGO_MODE=TEST`; cualquier otro valor invalida la configuración.
La elección correcta del Access Token TEST y su alcance exclusivo a Preview son
controles operativos necesarios, porque el prefijo no permite distinguirlo de
uno productivo.

Referencias oficiales:

- [Crear aplicación y credenciales de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/create-application).
- [Credenciales de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/credentials).
- [Realizar compras de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases).

### 3. Segundo 503: Payment ID ficticio del simulador

Después de corregir la configuración, los logs sanitizados confirmaron estas
etapas:

- configuración válida;
- firma válida;
- body válido;
- inicio de reconciliación;
- inicio de `Payment.get()`.

El ID `123456` usado por el simulador no correspondía a un pago consultable. El
lookup al proveedor fallaba y el endpoint respondía 503 reintentable. Ese
resultado no demostraba un defecto estructural de la firma, el body ni el
Route Handler: el simulador permitía probar la entrega del evento, pero no
reemplazaba un Payment real accesible por la credencial configurada.

### 4. Pago real aprobado, pero UI en `PENDING`

Se realizó un pago real dentro del entorno TEST. Mercado Pago volvió a
`/checkout/mercado-pago/success` con `code`, `payment_id`,
`external_reference`, `preference_id` y estados informativos de aprobación. La
pantalla, sin embargo, continuaba mostrando “Estamos confirmando tu pago”.

La inspección comprobó que:

- Next.js entregaba `searchParams` como valor awaitable y la página lo esperaba;
- se leía `payment_id`, que es el nombre enviado por Mercado Pago;
- `code` llegaba y encontraba el `CheckoutOrder` local;
- el Payment ID era numérico y llegaba a la reconciliación;
- `Payment.get()` se ejecutaba y devolvía el pago;
- la orden se releía desde PostgreSQL después de reconciliar.

Por lo tanto, el problema no estaba en los query params, el routing, Prisma ni
la ausencia de una llamada al proveedor.

### 5. Error silencioso en el retorno

El retorno contenía inicialmente este patrón:

```ts
await reconcileMercadoPagoPayment(paymentHint).catch(() => undefined);
```

Este `catch` mantenía una UX tolerante a fallos transitorios, pero descartaba
toda información diagnóstica. Errores de configuración, SDK/API, repositorio o
validación terminaban en el mismo síntoma visible: se releía una orden todavía
`PENDING`.

Se conservó la regla de no aprobar ante errores, pero se reemplazó el silencio
por callbacks de etapa y logs sanitizados. El retorno continúa mostrando un
estado seguro si la reconciliación falla; ahora el motivo puede distinguirse en
los logs del servidor.

### 6. Resultado `IGNORED`

La instrumentación mostró que la llamada y la consulta de orden terminaban sin
excepción, pero con:

```text
MP_RETURN_PAYMENT_LOOKUP_OK
MP_RETURN_RECONCILE_ORDER_LOOKUP_OK
MP_RETURN_RECONCILE_OK
reconcileOutcome: IGNORED

MP_RETURN_FINAL_STATE
checkoutState: PENDING
paymentStatus: null
```

Se agregaron códigos específicos inmediatamente antes de cada rama ignorada:

- `MP_RECONCILE_IGNORED_EXTERNAL_REFERENCE_FORMAT`;
- `MP_RECONCILE_IGNORED_ORDER_NOT_FOUND`;
- `MP_RECONCILE_IGNORED_EXTERNAL_REFERENCE_MISMATCH`;
- `MP_RECONCILE_IGNORED_LIVE_MODE` —existía durante el diagnóstico y fue
  eliminado junto con el bloqueo rígido—;
- `MP_RECONCILE_IGNORED_ALREADY_OWNED`.

### 7. Causa raíz definitiva

El pago TEST real `178730044702` produjo:

```text
MP_RECONCILE_IGNORED_LIVE_MODE
liveMode: true
currency: ARS
transactionAmount: 8500
expectedAmount: 8500
externalReference: coincidente
checkoutPublicCode: coincidente
```

La referencia, el monto y la moneda eran correctos. El pago se había realizado
con credenciales TEST, Buyer Test, medio de pago de prueba, Preview de Vercel y
`MERCADO_PAGO_MODE=TEST`. Aun así, la respuesta real de `Payment.get()` contenía
`live_mode=true`.

La causa raíz fue la condición local `payment.liveMode === false`, no una
aprobación falsa ni una inconsistencia de la orden. Esa condición descartaba un
pago TEST válido antes de consultar la propiedad del Payment ID y antes de
actualizar la orden.

Mercado Pago documenta el significado general de `live_mode`, pero no explica
este comportamiento observado ni expone otra señal contractual en Payment o
Preference que identifique inequívocamente el tipo de credencial usada en el
flujo moderno. Por ese motivo, `live_mode` no puede actuar como único límite de
seguridad en esta integración TEST.

## Hipótesis descartadas

| Hipótesis | Evidencia que la descartó |
| --- | --- |
| Vercel bloqueaba el webhook | Firewall `Allowed`, Function Invocation presente y ejecución dentro de Next.js. |
| El Route Handler no existía | `/api/webhooks/mercado-pago` era invocado y emitía logs por etapas. |
| Toda respuesta 503 era el mismo fallo | El primer 503 ocurrió antes de red por configuración; el posterior llegó a `Payment.get()` con un ID ficticio. |
| La firma válida se convertía en 503 | Firma inválida conserva 401; la instrumentación mostró `MP_WEBHOOK_STAGE_SIGNATURE_OK`. |
| El body del simulador era incompatible | El schema aceptó `payment.updated`, `payment` y `data.id`; apareció `MP_WEBHOOK_STAGE_BODY_OK`. |
| Next.js no entregaba `payment_id` | El retorno registró `MP_RETURN_PAYMENT_ID_PRESENT`. |
| Se esperaba `paymentId` en vez de `payment_id` | La página actual lee explícitamente `params.payment_id`. |
| La orden no existía | Se registraron `MP_RETURN_ORDER_FOUND` y el lookup de reconciliación correcto. |
| `Payment.get()` no se ejecutaba | Se registraron inicio y éxito del lookup del proveedor con el pago real. |
| La UI renderizaba solo la copia anterior | Después de reconciliar se ejecutó y registró el reload de la orden. |
| Referencia, monto o ARS no coincidían | Los valores diagnósticos reales coincidieron exactamente. |
| Debía confiarse en `status=approved` de la URL | Se descartó por diseño de seguridad; solo el estado consultado al proveedor puede persistirse. |

## Solución implementada

### Reconciliación compartida

Se retiró `testModeMatches: payment.liveMode === false` de la validación de
dominio y la rama `MP_RECONCILE_IGNORED_LIVE_MODE` de la reconciliación.
`liveMode` se conserva en el tipo recibido y en datos diagnósticos permitidos.

Como defensa explícita, la reconciliación compartida recibe el modo del entorno
y rechaza cualquier valor distinto de `TEST` antes de llamar a `Payment.get()`.
El wrapper utilizado por la aplicación obtiene ese modo del schema de variables,
que actualmente acepta únicamente el literal `TEST`.

### Webhook

El webhook tenía además un retorno anticipado 202 cuando la notificación
declaraba `live_mode=true`. Se eliminó para evitar una política distinta entre
webhook y return page. El flujo actual es:

1. validar configuración TEST;
2. limitar tamaño del body;
3. validar `x-signature` y coherencia de `data.id`;
4. aceptar solo eventos de pago permitidos;
5. ejecutar `Payment.get()`;
6. aplicar la reconciliación compartida;
7. responder según el resultado o la clase de fallo.

La firma del webhook sigue siendo obligatoria. El valor `live_mode` enviado en
la notificación no puede aprobar una operación ni evitar la consulta real.

### Reglas de seguridad preservadas

Una orden solo puede actualizarse después de comprobar:

1. `MERCADO_PAGO_MODE=TEST`;
2. configuración completa y credencial TEST elegida para Preview;
3. Payment ID numérico consultado con `Payment.get()`;
4. `CheckoutOrder` local identificado por un código público aleatorio;
5. `external_reference` exacto;
6. Payment ID no perteneciente a otra orden;
7. monto aprobado exacto en centavos;
8. moneda `ARS`;
9. estado real mapeado desde el proveedor;
10. idempotencia y protección contra regresiones desde `APPROVED`.

Revuelto no guarda número de tarjeta, CVV, datos de tarjeta ni credenciales del
comprador. `CheckoutOrder` conserva únicamente la correlación técnica, el
snapshot confiable, identificadores del proveedor, importes y estados.

## Resultado final

El mismo pago TEST existente pudo reconciliarse sin crear otro pago. La primera
ejecución válida dejó el `CheckoutOrder` en `APPROVED`; una recarga posterior
registró:

```text
MP_RETURN_PAYMENT_LOOKUP_OK
MP_RETURN_RECONCILE_ORDER_LOOKUP_OK
MP_RETURN_PAYMENT_OWNER_LOOKUP_START
MP_RETURN_PAYMENT_OWNER_LOOKUP_OK
MP_RETURN_RECONCILE_OK
reconcileOutcome: ALREADY_PROCESSED
MP_RETURN_ORDER_RELOAD_OK
MP_RETURN_FINAL_STATE
checkoutState: APPROVED
paymentStatus: approved
```

`ALREADY_PROCESSED` es el resultado esperado de una segunda reconciliación: no
duplica el pago, no repite efectos y no degrada el estado persistido.

## Logging de diagnóstico

Se incorporaron tres familias de eventos:

- `MP_WEBHOOK_*`: configuración, firma, body, lookup del proveedor, repositorio,
  actualización y clasificación de errores del webhook;
- `MP_RETURN_*`: lectura de parámetros, búsqueda inicial, reconciliación,
  reload y estado final de la página de retorno;
- `MP_RECONCILE_*`: motivo específico de cada resultado `IGNORED`.

Los logs solo admiten datos técnicos sanitizados: etapa, tipo de evento,
`liveMode`, Payment ID, status HTTP del proveedor, nombre/código genérico del
error, referencia técnica, moneda e importes cuando son necesarios para
diagnóstico. No registran Access Token, Webhook Secret, Authorization, cookies,
firma completa, bypass de Vercel, bodies completos ni datos personales.

Recomendación después de estabilizar Preview:

- conservar errores categorizados (`*_CONFIG_INVALID`, `*_SIGNATURE_INVALID`,
  `*_PAYMENT_NOT_FOUND`, `*_PROVIDER_ERROR`, `*_REPOSITORY_ERROR` y
  `*_UNEXPECTED_ERROR`);
- conservar actualización confirmada, outcome de reconciliación y estado final
  mientras se completan los escenarios TEST pendientes;
- reducir o retirar los numerosos eventos `*_START` y `*_OK` intermedios cuando
  dejen de aportar diagnóstico, porque duplican volumen en Vercel;
- evaluar si referencias e importes deben omitirse de logs operativos estables,
  aunque estén sanitizados y no sean credenciales.

No se retiró ningún log en esta tarea documental.

## Pruebas realizadas

La validación automatizada cubre, entre otros casos:

- configuración ausente o distinta de TEST rechazada;
- token TEST ficticio con formato `APP_USR` aceptado estructuralmente;
- firma válida, inválida o ausente;
- eventos y Payment ID válidos;
- pago TEST correlacionado con `liveMode=true`;
- referencia incorrecta ignorada;
- monto o moneda incorrectos sin aprobación;
- Payment ID perteneciente a otra orden ignorado;
- mapeo de `approved`, `pending`, `rejected` y `cancelled`;
- status desconocido conservado de forma segura como pendiente;
- idempotencia, duplicados y protección contra regresión;
- WhatsApp posterior habilitado solo para una orden persistida `APPROVED`.

La prueba manual comprobó la creación de Preference, retorno real, consulta
`Payment.get()`, persistencia `APPROVED`, UI confirmada y segunda reconciliación
idempotente. El simulador con `data.id=123456` no prueba un lookup exitoso porque
ese identificador no corresponde a un pago real.

## Cómo volver a probar en TEST

1. Confirmar que Preview tenga `MERCADO_PAGO_MODE=TEST`, Access Token TEST,
   Webhook Secret TEST y `APP_BASE_URL` del deployment, sin imprimir valores.
2. Confirmar con `npx prisma migrate status` que el esquema esté actualizado;
   no aplicar migraciones automáticamente.
3. Mantener Seller y Buyer Test separados y utilizar medios de pago de prueba.
4. Crear el pedido desde la UI para que servidor genere `CheckoutOrder`,
   snapshot y Preference; no fabricar códigos ni Payment IDs.
5. Completar Checkout Pro y volver por la back URL.
6. Verificar que el retorno ejecute `Payment.get()`, reconcilie, relea la orden
   y solo muestre confirmación cuando la base esté `APPROVED`.
7. Recargar la misma URL y comprobar `ALREADY_PROCESSED` sin efectos duplicados.
8. Probar el webhook con firma válida y un Payment ID real; interpretar el
   `123456` del simulador solo como prueba de entrega/firma.
9. Repetir escenarios `pending`, `rejected` y `cancelled` sin confiar en los
   estados informados por query string.

## Commits relacionados

El historial se verificó con `git log` y los cambios con `git show`/`git diff`.
Los commits reales relacionados, en orden cronológico, son:

| Commit | Mensaje exacto | Propósito técnico |
| --- | --- | --- |
| `a2b4ce8` | `Agrego Checkout Pro de Mercado Pago en modo test` | Implementación inicial de `CheckoutOrder`, Preference, gateway, webhook firmado, return pages, estados, idempotencia, migración y suite de tests. |
| `d039164` | `Correxion validacion de credenciales test de Mercado Pago` | Eliminó la exigencia incorrecta del prefijo `TEST-`, mantuvo modo TEST explícito y agregó cobertura para un token ficticio `APP_USR`. |
| `2ac6b0e` | `Agrego diagnostico sanitizado al webhook de Mercado Pago` | Agregó etapas de webhook/reconciliación, sanitización y clasificación de fallos de configuración, firma, proveedor y repositorio. |
| `f8e7183` | `Agrego diagnostico de reconciliacion Mercado Pago` | Sustituyó el catch silencioso del retorno por instrumentación sanitizada y distinguió lookup, repositorio y reconciliación. |
| `ec75741` | `Mejora al diagnostico de reconciliacion Mercado Pago` | Incorporó `reconcileOutcome` y el estado final recargado del `CheckoutOrder`. |
| `de0decb` | `Agrego diagnostico de ramas ignoradas de Mercado Pago` | Agregó una etapa concreta para cada rama `IGNORED`, lo que permitió identificar el bloqueo por `live_mode`. |
| `fedac2d` | `Estoy cansado jefe (Corrige reconciliacion de pagos test de Mercado Pago)` | Eliminó el bloqueo rígido por `live_mode`, unificó webhook/retorno, reforzó TEST-only y amplió los tests de correlación y estados. |

## Registro de trabajo

**Estimación técnica del tiempo invertido: 5 horas.** Es una distribución
aproximada basada en el trabajo realizado y los commits revisados; no es una
medición automática ni una duración demostrada por Git.

| Actividad | Tiempo estimado |
| --- | ---: |
| Implementación y configuración inicial de Checkout Pro TEST | 1h 15m |
| Investigación de los 503, Vercel Protection y simulador de webhook | 0h 45m |
| Revisión y corrección de credenciales TEST `APP_USR` | 0h 30m |
| Diagnóstico del retorno, catch silencioso e instrumentación por etapas | 0h 50m |
| Diagnóstico de ramas `IGNORED` e identificación de `live_mode` | 0h 45m |
| Corrección compartida para return page y webhook | 0h 25m |
| Tests, validaciones finales y documentación | 0h 30m |
| **Total** | **5h 00m** |

## Paso a producción

El flujo documentado está probado únicamente con `MERCADO_PAGO_MODE=TEST`. No
se habilitó producción. Antes de hacerlo se debe:

1. diseñar y revisar una configuración que permita explícitamente producción;
2. configurar credenciales productivas solo en el entorno Production de Vercel;
3. mantener separadas las variables Preview y Production;
4. revisar el Webhook Secret y la URL del webhook productivo;
5. cambiar y verificar `APP_BASE_URL` productivo;
6. revisar Vercel Protection sin copiar bypasses o secrets a documentación;
7. ejecutar una prueba productiva controlada con monto mínimo autorizado;
8. revisar nuevamente la política de `live_mode` con evidencia del proveedor;
9. no inferir nunca el ambiente por el prefijo `APP_USR`;
10. definir monitoreo y retención de logs antes de reducir la instrumentación.

La implementación actual bloquea todo modo distinto de TEST. El paso a
producción requerirá un cambio de código y configuración deliberado, revisado y
probado; no consiste solamente en reemplazar el Access Token.
