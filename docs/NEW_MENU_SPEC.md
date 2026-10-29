# Nueva carta de Revuelto

**Ampliación del 29 de octubre de 2026:** las cartas recibidas agregan cinco Revueltitos, tres Sanguchitos y seis renglones de bebidas. También informan los precios de los seis Revueltos definidos. Ver [MENU_CATALOG_2026-10-29.md](./MENU_CATALOG_2026-10-29.md). La indicación anterior de precios pendientes solo sigue vigente para `Tu Revuelto` y productos sin importe confirmado.

Esta especificación reúne las decisiones de producto vigentes. El código actual
todavía usa `Bowl` y `BowlSize` con `SMALL`/`LARGE`; los grupos de implementación
de abajo harán la transición. Los nombres y recetas anteriores en otros documentos
describen el sistema actual o un estado histórico, no la carta final.

## Reglas generales

- En la experiencia pública se dice **Revuelto**, no bowl.
- Hay seis Revueltos definidos y un único producto para armar, **Tu Revuelto**.
- Todos incluyen huevos revueltos, que nunca se pueden quitar.
- Hay un solo tamaño. El recipiente es de 20 oz, dato que no necesita destacarse
  en la carta pública. No trasladar `SMALL`, `LARGE`, 25 oz ni 35 oz al nuevo flujo.
- No hay fotos definitivas. Las cartas recibidas el 29 de octubre de 2026
  informan los precios de los seis Revueltos definidos, Revueltitos,
  Sanguchitos y bebidas. `Tu Revuelto` sigue sin precio confirmado. Un producto
  sin precio puede prepararse editorialmente, pero no cerrar un pedido.
- Los pedidos siguen siendo para retiro en sucursal y continúan por WhatsApp.
  Mercado Pago queda pausado; su compatibilidad de datos se conserva sin activar
  ni configurar pagos de producción.

## Revueltos definidos

| Orden y nombre comercial | Receta acordada | Salsa sugerida |
| --- | --- | --- |
| 1. Horneadito | Huevos revueltos; pollo macerado; calabaza asada; repollo, zanahorias y cebolla morada horneadas; pimientos asados; maní tostado. | Tzatziki. |
| 2. Crunchi | Huevos revueltos; pollo macerado; panceta crocante; calabaza asada; pepinos agridulces; palta cremosa; almendras tostadas. | Agridulce de zanahoria y jengibre. |
| 3. Gramajo | Huevos revueltos; jamón cocido salteado; queso; panceta crocante; cebolla caramelizada; papas pay; cebollita encurtida. | Dijon, miel, limón y yogur. |
| 4. Umami | Huevos revueltos; pollo macerado; portobellos salteados; cherry confitado; ceviche de zucchini; semillas de girasol garrapiñadas. | Zanahoria y jengibre. |
| 5. Veggie | Huevos revueltos; calabaza asada; brócoli salteado; cherry confitado; zanahorias y pimientos al horno; portobellos salteados; garrapiñada de girasol. | Soja, naranja y jengibre. |
| 6. Buenos días, buenas tardes | Huevos revueltos; queso; palta cremosa; cherrys; maní tostado; **exactamente una** opción entre panceta crocante y jamón salteado. | Por definir. |

Cada receta tiene sus ingredientes definidos. El detalle del producto tendrá
una presentación tipo selector con nombre, descripción, imagen cuando exista y
lista de ingredientes. Se muestran todos los configurados por el administrador:
los removibles se pueden desmarcar y los no removibles aparecen visibles en tono
gris o bloqueados. El
cliente no agrega ingredientes a estas recetas. Quitar uno no cambia el precio.
En **Buenos días, buenas tardes**, la elección entre jamón y panceta es
obligatoria y no se sustituye por una exclusión; el resto de la receta sigue la
regla de remoción administrada.

Las salsas de la tabla son *sugeridas* en la fuente de producto. No asumir que
se incluyen físicamente en cada receta ni convertirlas en un agregado hasta que
el negocio lo defina al cargar el catálogo.

## Tu Revuelto

Es el único producto con armado libre dentro de estas reglas:

- Base obligatoria: huevos revueltos, sin elección ni remoción.
- Proteína: exactamente una entre pollo macerado, jamón salteado y panceta
  crocante. No incluir pollo desmechado.
- Vegetales: hasta cuatro entre calabaza asada, repollo, cebolla, zanahoria,
  pimientos, brócoli, portobellos, cherry, pepino agridulce, cebolla
  caramelizada, arvejas, palta cremosa y ceviche de zucchini.
- Semillas/frutos secos: exactamente uno entre maní tostado, almendras tostadas
  y garrapiñada de girasol. Sésamo queda pendiente de confirmación y no se
  habilita por defecto.
- Salsa: exactamente una entre tzatziki, agridulce de zanahoria y jengibre,
  Dijon con miel, limón y yogur, y soja con naranja y jengibre.

Los límites se comprueban en el servidor, además de la interfaz. Antes de
cargar ingredientes se unificarán nombres como `cherry`/`cherrys`,
`pepino agridulce`/`pepinos agridulces` y `garrapiñada de girasol`/`semillas
de girasol garrapiñadas`, sin crear ingredientes nuevos por diferencia de texto.

## Panel administrativo

- Una sección global administra cada ingrediente por nombre e imagen opcional.
  Los productos usan ese catálogo para que una corrección global no requiera
  editar cada receta por separado.
- En cada Revuelto el administrador elige qué ingredientes del catálogo se
  muestran, su orden y cuáles se pueden quitar. Los huevos siempre están
  bloqueados. La elección obligatoria de jamón o panceta también debe seguir
  siendo válida después de cualquier exclusión.
- El administrador gestiona nombre, descripción, foto, precio y visibilidad
  del Revuelto. No se exige foto ni precio ficticio durante la preparación de la
  carta; la posibilidad de pedirlo dependerá de un precio válido.
- Las opciones de Tu Revuelto también proceden del catálogo global, agrupadas
  por categoría y sujetas a los límites anteriores.
- Las recomendaciones de bebidas al final del detalle se configuran en código,
  no en este panel. Son otros productos del pedido, no toppings.

## Pedidos y compatibilidad

- Carrito, validación del servidor y WhatsApp deben conservar la variante elegida
  de **Buenos días, buenas tardes**, las exclusiones de recetas fijas y las
  selecciones de **Tu Revuelto**. El servidor calcula precios y comprueba
  opciones contra el catálogo vigente; no confía en nombres ni importes del
  navegador.
- Los pedidos ya guardados conservan su snapshot histórico. La nueva forma de
  snapshot debe poder coexistir con la anterior de Mercado Pago sin alterar
  órdenes previas. No se reanuda Checkout Pro en esta etapa.
- La migración del esquema será progresiva y revisada; no se borrarán tamaños ni
  datos anteriores hasta verificar el reemplazo.

## Grupos de implementación

1. Contrato funcional y documentación (este grupo).
2. Modelo de datos y migración aditiva del catálogo global, recetas y tamaño
   único, conservando datos anteriores.
3. CRUD administrativo de ingredientes globales e imágenes.
4. Edición administrativa de Revueltos, visibilidad, foto, precio, relación con
   ingredientes y permiso de remoción.
5. Carta pública y detalle de producto con exclusiones y elecciones obligatorias.
6. Carrito, validación servidor y WhatsApp para las nuevas configuraciones.
7. Compatibilidad de snapshots y Checkout Pro existente, sin reactivar pagos.
8. Recomendaciones de bebidas y limpieza del modelo legado una vez validada la
   migración; la eliminación de datos requiere autorización aparte.

Cada grupo se revisa y prueba antes de que el usuario ejecute su commit. Los
comandos de Git que modifiquen índice, historial, ramas o remoto los realiza el
usuario.
