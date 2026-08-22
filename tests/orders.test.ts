import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  addCartItem,
  getCartLineQuantity,
  getCartPreview,
  getEstimatedCartTotalCents,
  parseStoredCart,
  removeCartItem,
  serializeCart,
  setCartItemQuantity,
  shouldShowCartBottomBar,
} from "../lib/orders/cart";
import {
  CART_STORAGE_VERSION,
  ORDER_MAX_QUANTITY_PER_LINE,
  ORDER_MAX_TOTAL_UNITS,
  getTotalCartUnits,
  prepareOrderSchema,
  type CartItem,
  type PrepareOrderInput,
} from "../lib/orders/schema";
import { prepareOrderFromCatalog, PublicOrderError, type OrderCatalog } from "../lib/orders/service";
import { buildOrderMessage, buildOrderWhatsAppUrl } from "../lib/orders/whatsapp";
import { isPublicOrderRateLimited, ORDER_RATE_LIMIT_MAX_REQUESTS, ORDER_RATE_LIMIT_WINDOW_MS } from "../lib/orders/rate-limit";

const bowlId = "11111111-1111-4111-8111-111111111111";
const merchandiseId = "22222222-2222-4222-8222-222222222222";
const branchId = "33333333-3333-4333-8333-333333333333";

const small = { type: "BOWL", productId: bowlId, size: "SMALL" } as const;
const large = { type: "BOWL", productId: bowlId, size: "LARGE" } as const;
const merch = { type: "MERCHANDISE", productId: merchandiseId } as const;

function catalog(overrides: Partial<OrderCatalog> = {}): OrderCatalog {
  return {
    orderingEnabled: true,
    cashEnabled: true,
    transferEnabled: true,
    mercadoPagoEnabled: false,
    bowls: [{
      id: bowlId,
      name: "Revuelto Clásico",
      isAvailable: true,
      isArchived: false,
      sizes: [
        { size: "SMALL", ounces: 25, price: "6500.00", isAvailable: true },
        { size: "LARGE", ounces: 35, price: "8000.00", isAvailable: true },
      ],
    }],
    merchandise: [{ id: merchandiseId, name: "Tote Bag", price: "7000.00", isActive: true }],
    branch: { id: branchId, name: "Centro", isActive: true, whatsappNumber: "+54 9 341 555 1234" },
    ...overrides,
  };
}

function input(items: CartItem[], paymentMethod: PrepareOrderInput["paymentMethod"] = "CASH"): PrepareOrderInput {
  return { branchId, paymentMethod, items };
}

function expectOrderError(callback: () => unknown, code: PublicOrderError["code"]) {
  assert.throws(callback, (error) => error instanceof PublicOrderError && error.code === code);
}

test("el carrito agrega Bowl SMALL, Bowl LARGE y merchandising como líneas independientes", () => {
  const items = addCartItem(addCartItem(addCartItem([], small), large), merch);
  assert.deepEqual(items.map((item) => item.type === "BOWL" ? item.size : item.type), ["SMALL", "LARGE", "MERCHANDISE"]);
});

test("incrementa, decrementa y elimina cantidades", () => {
  const once = addCartItem([], small);
  const twice = addCartItem(once, small);
  assert.equal(twice[0].quantity, 2);
  const decremented = setCartItemQuantity(twice, `BOWL:${bowlId}:SMALL`, 1);
  assert.equal(decremented[0].quantity, 1);
  assert.deepEqual(removeCartItem(decremented, `BOWL:${bowlId}:SMALL`), []);
});

test("los contadores de SMALL, LARGE y merchandising permanecen independientes", () => {
  const items = [
    { ...small, quantity: 2 },
    { ...large, quantity: 3 },
    { ...merch, quantity: 4 },
  ] satisfies CartItem[];
  assert.equal(getCartLineQuantity(items, `BOWL:${bowlId}:SMALL`), 2);
  assert.equal(getCartLineQuantity(items, `BOWL:${bowlId}:LARGE`), 3);
  assert.equal(getCartLineQuantity(items, `MERCHANDISE:${merchandiseId}`), 4);
  assert.equal(getTotalCartUnits(items), 9);
  assert.deepEqual(setCartItemQuantity(items, `BOWL:${bowlId}:SMALL`, 0).map((item) => item.type === "BOWL" ? item.size : item.type), ["LARGE", "MERCHANDISE"]);
});

test("la barra inferior aparece sólo con productos y calcula el total estimado", () => {
  const items = [{ ...small, quantity: 2 }, { ...merch, quantity: 1 }] satisfies CartItem[];
  const prices = new Map([[`BOWL:${bowlId}:SMALL`, 650_000], [`MERCHANDISE:${merchandiseId}`, 700_000]]);
  assert.equal(shouldShowCartBottomBar([]), false);
  assert.equal(shouldShowCartBottomBar(items), true);
  assert.equal(getEstimatedCartTotalCents(items, prices), 2_000_000);
});

test("la vista previa conserva hasta tres líneas y resume las restantes", () => {
  const fourthMerchId = "44444444-4444-4444-8444-444444444444";
  const items = [
    { ...small, quantity: 1 },
    { ...large, quantity: 1 },
    { ...merch, quantity: 2 },
    { type: "MERCHANDISE", productId: fourthMerchId, quantity: 1 },
  ] satisfies CartItem[];
  const preview = getCartPreview(items);
  assert.deepEqual(preview.visible, items.slice(0, 3));
  assert.equal(preview.remainingLines, 1);
});

test("la barra abre el mismo drawer y recibe las imágenes del catálogo", () => {
  const providerSource = readFileSync(path.resolve("components/public/order/cart-provider.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve("app/page.tsx"), "utf8");
  assert.match(providerSource, /onOpen=\{\(opener\) => context\.open\(opener\)\}/);
  assert.match(pageSource, /imageUrl: bowl\.imageUrl/);
  assert.match(pageSource, /imageUrl: item\.imageUrl/);
});

test("respeta máximo por línea y máximo total", () => {
  let items: CartItem[] = [];
  for (let index = 0; index < ORDER_MAX_QUANTITY_PER_LINE + 2; index += 1) items = addCartItem(items, small);
  assert.equal(items[0].quantity, ORDER_MAX_QUANTITY_PER_LINE);
  const filled = [
    { ...small, quantity: 20 },
    { ...large, quantity: 20 },
    { ...merch, quantity: 10 },
  ] satisfies CartItem[];
  assert.equal(filled.reduce((total, item) => total + item.quantity, 0), ORDER_MAX_TOTAL_UNITS);
  assert.deepEqual(addCartItem(filled, merch), filled);
});

test("localStorage versionado restaura estado válido y descarta estado inválido", () => {
  const items = [{ ...small, quantity: 2 }] satisfies CartItem[];
  assert.deepEqual(parseStoredCart(serializeCart(items)), items);
  assert.deepEqual(parseStoredCart("{no-json"), []);
  assert.deepEqual(parseStoredCart(JSON.stringify({ version: CART_STORAGE_VERSION + 1, items })), []);
  assert.deepEqual(parseStoredCart(JSON.stringify({ version: CART_STORAGE_VERSION, items: [{ ...small, quantity: 0 }] })), []);
});

test("Zod rechaza cero, negativos, fracciones, exceso, IDs y tamaños inválidos", () => {
  const base = input([{ ...small, quantity: 1 }]);
  for (const quantity of [0, -1, 1.5, ORDER_MAX_QUANTITY_PER_LINE + 1, Number.NaN]) {
    assert.equal(prepareOrderSchema.safeParse({ ...base, items: [{ ...small, quantity }] }).success, false);
  }
  assert.equal(prepareOrderSchema.safeParse({ ...base, branchId: "no-uuid" }).success, false);
  assert.equal(prepareOrderSchema.safeParse({ ...base, items: [{ ...small, size: "MEDIUM" }] }).success, false);
});

test("el servidor rechaza precios y totales enviados por el navegador", () => {
  const base = input([{ ...small, quantity: 1 }]);
  assert.equal(prepareOrderSchema.safeParse({ ...base, total: 1 }).success, false);
  assert.equal(prepareOrderSchema.safeParse({ ...base, items: [{ ...small, quantity: 1, price: 1, name: "Hack" }] }).success, false);
});

test("recalcula SMALL, LARGE y merchandising con precios del catálogo servidor", () => {
  const prepared = prepareOrderFromCatalog(input([
    { ...small, quantity: 2 },
    { ...large, quantity: 1 },
    { ...merch, quantity: 1 },
  ]), catalog());
  assert.equal(prepared.totalCents, 2_800_000);
  assert.deepEqual(prepared.lines.map((line) => line.unitPriceCents), [650_000, 800_000, 700_000]);
});

test("rechaza Bowl inexistente, inactivo, archivado o tamaño inexistente", () => {
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ bowls: [] })), "ITEM_UNAVAILABLE");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ bowls: [{ ...catalog().bowls[0], isAvailable: false }] })), "ITEM_UNAVAILABLE");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ bowls: [{ ...catalog().bowls[0], isArchived: true }] })), "ITEM_UNAVAILABLE");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ bowls: [{ ...catalog().bowls[0], sizes: [] }] })), "ITEM_UNAVAILABLE");
});

test("rechaza merchandising inexistente o inactivo", () => {
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...merch, quantity: 1 }]), catalog({ merchandise: [] })), "ITEM_UNAVAILABLE");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...merch, quantity: 1 }]), catalog({ merchandise: [{ ...catalog().merchandise[0], isActive: false }] })), "ITEM_UNAVAILABLE");
});

test("rechaza Branch inexistente, inactiva o sin WhatsApp válido", () => {
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ branch: null })), "BRANCH_UNAVAILABLE");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ branch: { ...catalog().branch!, isActive: false } })), "BRANCH_UNAVAILABLE");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ branch: { ...catalog().branch!, whatsappNumber: "abc" } })), "BRANCH_UNAVAILABLE");
});

test("respeta pedidos, efectivo, transferencia y Mercado Pago deshabilitados", () => {
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ orderingEnabled: false })), "ORDERING_DISABLED");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }]), catalog({ cashEnabled: false })), "PAYMENT_UNAVAILABLE");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }], "TRANSFER"), catalog({ transferEnabled: false })), "PAYMENT_UNAVAILABLE");
  expectOrderError(() => prepareOrderFromCatalog(input([{ ...small, quantity: 1 }], "MERCADO_PAGO"), catalog({ mercadoPagoEnabled: true })), "PAYMENT_UNAVAILABLE");
});

test("genera mensajes claros para efectivo y transferencia con mezcla de productos", () => {
  const lines = prepareOrderFromCatalog(input([{ ...small, quantity: 2 }, { ...merch, quantity: 1 }]), catalog()).lines;
  const cash = buildOrderMessage(lines, 2_000_000, "CASH");
  const transfer = buildOrderMessage(lines, 2_000_000, "TRANSFER");
  assert.match(cash, /^¡Hola! 👋 Quiero hacer este pedido:/);
  assert.match(cash, /🍳 COMIDA\n• 2 × Revuelto Clásico — Chico \(25 oz\) — \$\s*13\.000/);
  assert.match(cash, /🛍️ MERCH\n• 1 × Tote Bag — \$\s*7\.000/);
  assert.match(cash, /💰 Total: \$\s*20\.000/);
  assert.match(cash, /💵 Forma de pago: Efectivo/);
  assert.match(transfer, /💳 Forma de pago: Transferencia/);
  assert.match(cash, /¡Gracias! 🙌$/);
  assert.doesNotMatch(transfer, /Pago confirmado/);
});

test("WhatsApp usa el número normalizado de Branch y codifica el mensaje", () => {
  const message = "Hola\n2 × Revuelto Clásico — $13.000";
  const url = buildOrderWhatsAppUrl("+54 9 341 555 1234", message);
  assert.ok(url);
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "web.whatsapp.com");
  assert.equal(parsed.pathname, "/send");
  assert.equal(parsed.searchParams.get("phone"), "5493415551234");
  assert.equal(parsed.searchParams.get("text"), message);
  assert.equal(new URL(buildOrderWhatsAppUrl("341 555 1234", message)!).searchParams.get("phone"), "5493415551234");
  assert.equal(buildOrderWhatsAppUrl("5551234", message), null);
});

test("WhatsApp conserva Unicode completo en el mensaje y tras codificar la URL", () => {
  const lines = prepareOrderFromCatalog(input([{ ...small, quantity: 1 }, { ...merch, quantity: 1 }]), catalog()).lines;
  const message = buildOrderMessage(lines, 1_350_000, "CASH");
  const url = buildOrderWhatsAppUrl("+54 9 341 555 1234", message);
  assert.ok(url);

  for (const symbol of ["👋", "🍳", "🛍️", "💰", "💵", "🙌", "×", "•"]) {
    assert.ok(message.includes(symbol), `El mensaje debe conservar ${symbol}`);
    assert.equal(new URL(url).searchParams.get("text")?.includes(symbol), true, `La URL debe conservar ${symbol}`);
  }
  const replacementCharacter = String.fromCodePoint(0xfffd);
  assert.equal(message.includes(replacementCharacter), false);
  assert.equal((new URL(url).searchParams.get("text") ?? "").includes(replacementCharacter), false);

  const routeSource = readFileSync(path.resolve("app/api/orders/prepare/route.ts"), "utf8");
  assert.match(routeSource, /application\/json; charset=utf-8/);
});

test("la URL de WhatsApp conserva exactamente el mensaje Unicode aislado", () => {
  const testMessage = "👋 🍳 🛍️ 💰 💵 🙌 • × á é ñ";
  const url = buildOrderWhatsAppUrl("+54 9 341 555 1234", testMessage);
  assert.ok(url);
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "web.whatsapp.com");
  assert.equal(parsed.pathname, "/send");
  assert.equal(parsed.searchParams.get("phone"), "5493415551234");
  const decoded = parsed.searchParams.get("text");
  assert.equal(decoded, testMessage);
  assert.equal(decoded?.includes(String.fromCodePoint(0xfffd)), false);
});

test("el endpoint público usa un rate limit Prisma persistente y no uno en memoria", () => {
  assert.equal(ORDER_RATE_LIMIT_MAX_REQUESTS, 20);
  assert.equal(ORDER_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
  assert.equal(isPublicOrderRateLimited(19), false);
  assert.equal(isPublicOrderRateLimited(20), true);
  const source = readFileSync(path.resolve("lib/orders/rate-limit.ts"), "utf8");
  assert.match(source, /publicOrderRateLimit/);
  assert.doesNotMatch(source, /new Map/);
});
