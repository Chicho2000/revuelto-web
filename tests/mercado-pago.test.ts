import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import type { CheckoutOrder, Prisma } from "../generated/prisma/client";
import { parseMercadoPagoEnvironment } from "../lib/env";
import {
  buildPublicCheckoutView,
  initiateMercadoPagoCheckoutWithDependencies,
  MercadoPagoCheckoutError,
  reconcileMercadoPagoPaymentWithDependencies,
} from "../lib/mercado-pago/checkout";
import {
  buildCheckoutBackUrls,
  buildCheckoutSnapshot,
  buildPreferenceRequest,
  createPublicCheckoutCode,
  getSnapshotTotalCents,
  mapMercadoPagoStatus,
  mercadoPagoAmountToCents,
  PUBLIC_CHECKOUT_CODE_PATTERN,
  validatePaymentForCheckout,
} from "../lib/mercado-pago/domain";
import type { MercadoPagoPayment } from "../lib/mercado-pago/types";
import { checkoutOrderSnapshotSchema } from "../lib/mercado-pago/types";
import { mercadoPagoNotificationSchema } from "../lib/mercado-pago/webhook";
import { prepareOrderSchema, type PrepareOrderInput } from "../lib/orders/schema";
import { calculateOrderFromCatalog, PublicOrderError, type OrderCatalog } from "../lib/orders/service";
import { buildConfirmedMercadoPagoMessage, buildOrderWhatsAppUrls } from "../lib/orders/whatsapp";

const bowlId = "11111111-1111-4111-8111-111111111111";
const merchandiseId = "22222222-2222-4222-8222-222222222222";
const branchId = "33333333-3333-4333-8333-333333333333";
const publicCode = "RVT-00112233445566778899AABB";
const now = new Date("2026-09-10T12:00:00.000Z");

const input: PrepareOrderInput = {
  branchId,
  paymentMethod: "MERCADO_PAGO",
  items: [
    { type: "BOWL", productId: bowlId, size: "SMALL", quantity: 2 },
    { type: "MERCHANDISE", productId: merchandiseId, quantity: 1 },
  ],
};

function catalog(overrides: Partial<OrderCatalog> = {}): OrderCatalog {
  return {
    orderingEnabled: true,
    cashEnabled: true,
    transferEnabled: true,
    mercadoPagoEnabled: true,
    bowls: [{
      id: bowlId,
      name: "Revuelto Clásico",
      isAvailable: true,
      isArchived: false,
      sizes: [{ size: "SMALL", ounces: 25, price: "8500.00", isAvailable: true }],
    }],
    merchandise: [{ id: merchandiseId, name: "Tote Bag", price: "4500.00", isActive: true }],
    branch: { id: branchId, name: "Centro", isActive: true, whatsappNumber: "+54 9 341 555 1234" },
    ...overrides,
  };
}

function expectOrderError(callback: () => unknown, code: PublicOrderError["code"]) {
  assert.throws(callback, (error) => error instanceof PublicOrderError && error.code === code);
}

function checkoutRecord(overrides: Partial<CheckoutOrder> = {}): CheckoutOrder {
  const calculated = calculateOrderFromCatalog(input, catalog());
  const snapshot = buildCheckoutSnapshot(input, calculated.lines, {
    id: branchId,
    name: calculated.branchName,
    whatsappNumber: calculated.whatsappNumber,
  });
  return {
    id: "44444444-4444-4444-8444-444444444444",
    publicCode,
    clientRequestId: "55555555-5555-4555-8555-555555555555",
    requestHash: "request-hash",
    branchId,
    paymentMethod: "MERCADO_PAGO",
    paymentStatus: "PENDING",
    currency: "ARS",
    subtotalCents: calculated.totalCents,
    totalCents: calculated.totalCents,
    itemsSnapshot: snapshot as unknown as Prisma.JsonValue,
    mercadoPagoIdempotencyKey: "66666666-6666-4666-8666-666666666666",
    mercadoPagoPreferenceId: null,
    mercadoPagoPaymentId: null,
    mercadoPagoStatus: null,
    mercadoPagoInitPoint: null,
    expiresAt: new Date("2026-09-11T12:00:00.000Z"),
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function payment(overrides: Partial<MercadoPagoPayment> = {}): MercadoPagoPayment {
  return {
    id: "987",
    status: "approved",
    transactionAmount: 21_500,
    currencyId: "ARS",
    externalReference: publicCode,
    liveMode: false,
    dateApproved: "2026-09-10T12:10:00.000Z",
    ...overrides,
  };
}

test("Mercado Pago recalcula bowls, merchandising y carrito mixto desde catálogo servidor", () => {
  const calculated = calculateOrderFromCatalog(input, catalog());
  assert.equal(calculated.totalCents, 2_150_000);
  assert.deepEqual(calculated.lines.map((line) => line.unitPriceCents), [850_000, 450_000]);
  const changed = calculateOrderFromCatalog(input, catalog({ bowls: [{ ...catalog().bowls[0], sizes: [{ size: "SMALL", ounces: 25, price: "9000.00", isAvailable: true }] }] }));
  assert.equal(changed.totalCents, 2_250_000);
});

test("Mercado Pago rechaza configuración, productos y sucursal no disponibles", () => {
  expectOrderError(() => calculateOrderFromCatalog(input, catalog({ orderingEnabled: false })), "ORDERING_DISABLED");
  expectOrderError(() => calculateOrderFromCatalog(input, catalog({ mercadoPagoEnabled: false })), "PAYMENT_UNAVAILABLE");
  expectOrderError(() => calculateOrderFromCatalog(input, catalog({ bowls: [{ ...catalog().bowls[0], isAvailable: false }] })), "ITEM_UNAVAILABLE");
  expectOrderError(() => calculateOrderFromCatalog(input, catalog({ merchandise: [{ ...catalog().merchandise[0], isActive: false }] })), "ITEM_UNAVAILABLE");
  expectOrderError(() => calculateOrderFromCatalog(input, catalog({ branch: null })), "BRANCH_UNAVAILABLE");
});

test("el schema público rechaza total, precios, status e ids de Mercado Pago enviados por cliente", () => {
  for (const injected of [
    { total: 1 },
    { paymentStatus: "APPROVED" },
    { mercadoPagoPaymentId: "1" },
    { whatsappNumber: "5499999999999" },
  ]) {
    assert.equal(prepareOrderSchema.safeParse({ ...input, ...injected }).success, false);
  }
});

test("snapshot congela nombres, tamaños, cantidades y centavos exactos", () => {
  const calculated = calculateOrderFromCatalog(input, catalog());
  const snapshot = buildCheckoutSnapshot(input, calculated.lines, { id: branchId, name: calculated.branchName, whatsappNumber: calculated.whatsappNumber });
  assert.deepEqual(snapshot.items[0], {
    type: "BOWL", sourceId: bowlId, name: "Revuelto Clásico", size: "SMALL", ounces: 25,
    quantity: 2, unitPriceCents: 850_000, subtotalCents: 1_700_000,
  });
  assert.equal(snapshot.items[1].subtotalCents, 450_000);
  assert.equal(getSnapshotTotalCents(snapshot), 2_150_000);
  assert.equal(checkoutOrderSnapshotSchema.safeParse({
    ...snapshot,
    items: [{ ...snapshot.items[0], subtotalCents: 1 }],
  }).success, false);
});

test("la configuración exige Access Token TEST, webhook secret y APP_BASE_URL HTTPS pública", () => {
  const valid = {
    MERCADO_PAGO_ACCESS_TOKEN: "TEST-access-token-long-enough",
    MERCADO_PAGO_WEBHOOK_SECRET: "webhook-secret-long-enough",
    MERCADO_PAGO_MODE: "TEST",
    APP_BASE_URL: "https://revuelto-preview.example.com/",
  };
  assert.equal(parseMercadoPagoEnvironment(valid)?.APP_BASE_URL, "https://revuelto-preview.example.com");
  assert.equal(parseMercadoPagoEnvironment({ ...valid, MERCADO_PAGO_ACCESS_TOKEN: undefined }), null);
  assert.equal(parseMercadoPagoEnvironment({ ...valid, MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-production-token-long" }), null);
  assert.equal(parseMercadoPagoEnvironment({ ...valid, MERCADO_PAGO_WEBHOOK_SECRET: undefined }), null);
  assert.equal(parseMercadoPagoEnvironment({ ...valid, APP_BASE_URL: "http://localhost:3000" }), null);
});

test("preference usa ARS, external_reference, back_urls y monto exacto", () => {
  const calculated = calculateOrderFromCatalog(input, catalog());
  const snapshot = buildCheckoutSnapshot(input, calculated.lines, { id: branchId, name: calculated.branchName, whatsappNumber: calculated.whatsappNumber });
  const from = new Date("2026-09-10T12:00:00.000Z");
  const to = new Date("2026-09-11T12:00:00.000Z");
  const preference = buildPreferenceRequest(snapshot, "RVT-00112233445566778899AABB", "https://preview.example.com", from, to);
  assert.deepEqual(preference.items.map((item) => [item.quantity, item.unit_price, item.currency_id]), [[2, 8500, "ARS"], [1, 4500, "ARS"]]);
  assert.equal(preference.external_reference, "RVT-00112233445566778899AABB");
  assert.equal(preference.auto_return, "approved");
  assert.deepEqual(preference.back_urls, buildCheckoutBackUrls("https://preview.example.com", preference.external_reference));
  assert.equal(preference.expiration_date_to, to.toISOString());
});

test("creación persiste CheckoutOrder, preference e init_point usando gateway mock", async () => {
  let created: CheckoutOrder | null = null;
  let createdTotalCents = 0;
  let preferenceExternalReference = "";
  let preferenceKey = "";
  const initPoint = "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=TEST";
  const result = await initiateMercadoPagoCheckoutWithDependencies(input, "55555555-5555-4555-8555-555555555555", {
    appBaseUrl: "https://preview.example.com",
    gateway: {
      async createPreference(request, idempotencyKey) {
        preferenceExternalReference = request.external_reference;
        preferenceKey = idempotencyKey;
        return { id: "preference-test", initPoint };
      },
      async getPayment() { throw new Error("unexpected payment lookup"); },
    },
    getCatalog: async () => catalog(),
    createOrder: async (draft) => {
      created = checkoutRecord({
        ...draft,
        itemsSnapshot: draft.itemsSnapshot as Prisma.JsonValue,
        createdAt: now,
        updatedAt: now,
      });
      createdTotalCents = draft.totalCents;
      return created;
    },
    savePreference: async (_id, preference) => checkoutRecord({
      ...(created ?? {}),
      mercadoPagoPreferenceId: preference.id,
      mercadoPagoInitPoint: preference.initPoint,
    }),
    now: () => now,
    createUuid: (() => {
      const values = ["44444444-4444-4444-8444-444444444444", "66666666-6666-4666-8666-666666666666"];
      return () => values.shift()!;
    })(),
    createPublicCode: () => publicCode,
    hashRequest: () => "request-hash",
    reportProviderError: () => assert.fail("unexpected provider error"),
  });

  assert.equal(result.initPoint, initPoint);
  assert.equal(createdTotalCents, 2_150_000);
  assert.equal(preferenceExternalReference, publicCode);
  assert.equal(preferenceKey, "66666666-6666-4666-8666-666666666666");
});

test("reintento idempotente reutiliza preference y conflicto de payload se rechaza", async () => {
  let gatewayCalls = 0;
  const existing = checkoutRecord({
    requestHash: "expected",
    mercadoPagoPreferenceId: "preference-test",
    mercadoPagoInitPoint: "https://www.mercadopago.com.ar/test",
  });
  const dependencies = {
    appBaseUrl: "https://preview.example.com",
    gateway: {
      async createPreference() { gatewayCalls += 1; throw new Error("must not run"); },
      async getPayment() { throw new Error("must not run"); },
    },
    getCatalog: async () => catalog(),
    createOrder: async () => existing,
    savePreference: async () => existing,
    now: () => now,
    createUuid: () => "77777777-7777-4777-8777-777777777777",
    createPublicCode: () => publicCode,
    hashRequest: () => "expected",
    reportProviderError: () => assert.fail("unexpected provider error"),
  };
  const reused = await initiateMercadoPagoCheckoutWithDependencies(input, existing.clientRequestId, dependencies);
  assert.equal(reused.initPoint, existing.mercadoPagoInitPoint);
  assert.equal(gatewayCalls, 0);
  await assert.rejects(
    initiateMercadoPagoCheckoutWithDependencies(input, existing.clientRequestId, { ...dependencies, hashRequest: () => "different" }),
    (error) => error instanceof MercadoPagoCheckoutError && error.code === "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(gatewayCalls, 0);
});

test("publicCode tiene 96 bits aleatorios y no es secuencial", () => {
  const first = createPublicCheckoutCode();
  const second = createPublicCheckoutCode();
  assert.match(first, PUBLIC_CHECKOUT_CODE_PATTERN);
  assert.match(second, PUBLIC_CHECKOUT_CODE_PATTERN);
  assert.notEqual(first, second);
});

test("validación de pago exige referencia, monto, ARS y live_mode false", () => {
  const payment: MercadoPagoPayment = {
    id: "987", status: "approved", transactionAmount: 21500, currencyId: "ARS",
    externalReference: "RVT-00112233445566778899AABB", liveMode: false, dateApproved: null,
  };
  const checkout = { publicCode: payment.externalReference, totalCents: 2_150_000 };
  assert.deepEqual(validatePaymentForCheckout(payment, checkout), {
    externalReferenceMatches: true, amountMatches: true, currencyMatches: true, testModeMatches: true,
  });
  assert.equal(validatePaymentForCheckout({ ...payment, transactionAmount: 1 }, checkout).amountMatches, false);
  assert.equal(validatePaymentForCheckout({ ...payment, currencyId: "USD" }, checkout).currencyMatches, false);
  assert.equal(validatePaymentForCheckout({ ...payment, externalReference: "RVT-FFFFFFFFFFFFFFFFFFFFFFFF" }, checkout).externalReferenceMatches, false);
  assert.equal(validatePaymentForCheckout({ ...payment, liveMode: true }, checkout).testModeMatches, false);
  assert.equal(mercadoPagoAmountToCents(21500), 2_150_000);
  assert.equal(mercadoPagoAmountToCents(1.001), null);
});

test("mapea estados conocidos y mantiene estados desconocidos en PENDING", () => {
  assert.equal(mapMercadoPagoStatus("approved"), "APPROVED");
  assert.equal(mapMercadoPagoStatus("rejected"), "REJECTED");
  assert.equal(mapMercadoPagoStatus("pending"), "PENDING");
  assert.equal(mapMercadoPagoStatus("cancelled"), "CANCELLED");
  assert.equal(mapMercadoPagoStatus("refunded"), "REFUNDED");
  assert.equal(mapMercadoPagoStatus("future_unknown"), "PENDING");
});

test("x-signature válida se acepta y firmas inválidas o ausentes se rechazan", () => {
  const secret = "test-webhook-secret-long-enough";
  const dataId = "123456";
  const requestId = "request-abc";
  const ts = "1700000000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const signature = createHmac("sha256", secret).update(manifest).digest("hex");
  assert.doesNotThrow(() => WebhookSignatureValidator.validate({ xSignature: `ts=${ts},v1=${signature}`, xRequestId: requestId, dataId, secret }));
  assert.throws(() => WebhookSignatureValidator.validate({ xSignature: `ts=${ts},v1=${"0".repeat(64)}`, xRequestId: requestId, dataId, secret }), InvalidWebhookSignatureError);
  assert.throws(() => WebhookSignatureValidator.validate({ xSignature: null, xRequestId: requestId, dataId, secret }), InvalidWebhookSignatureError);
});

test("webhook acepta únicamente payment.created/payment.updated y payment id válido", () => {
  const base = { type: "payment", live_mode: false, data: { id: "123456" } };
  assert.equal(mercadoPagoNotificationSchema.safeParse({ ...base, action: "payment.created" }).success, true);
  assert.equal(mercadoPagoNotificationSchema.safeParse({ ...base, action: "payment.updated" }).success, true);
  assert.equal(mercadoPagoNotificationSchema.safeParse({ ...base, action: "merchant_order" }).success, false);
  assert.equal(mercadoPagoNotificationSchema.safeParse({ ...base, action: "payment.created", data: { id: "not-a-payment" } }).success, false);
});

test("reconciliación mock consulta el pago real, aprueba e ignora duplicados", async () => {
  let record = checkoutRecord();
  let lookups = 0;
  let updates = 0;
  const gateway = {
    async createPreference() { throw new Error("unexpected preference"); },
    async getPayment(id: string) { lookups += 1; assert.equal(id, "987"); return payment(); },
  };
  const dependencies = {
    gateway,
    findByPublicCode: async () => record,
    findByPaymentId: async () => null,
    updatePayment: async (_checkout: CheckoutOrder, update: Parameters<typeof reconcileMercadoPagoPaymentWithDependencies>[1]["updatePayment"] extends (checkout: CheckoutOrder, input: infer T) => Promise<CheckoutOrder> ? T : never) => {
      updates += 1;
      record = checkoutRecord({
        paymentStatus: update.paymentStatus,
        mercadoPagoPaymentId: update.paymentId,
        mercadoPagoStatus: update.mercadoPagoStatus,
        paidAt: update.paidAt ?? null,
      });
      return record;
    },
    reportMismatch: () => assert.fail("unexpected mismatch"),
    reportUnknownStatus: () => assert.fail("unexpected status"),
  };
  assert.equal((await reconcileMercadoPagoPaymentWithDependencies("987", dependencies)).outcome, "UPDATED");
  assert.equal(record.paymentStatus, "APPROVED");
  assert.equal((await reconcileMercadoPagoPaymentWithDependencies("987", dependencies)).outcome, "ALREADY_PROCESSED");
  assert.equal(lookups, 2);
  assert.equal(updates, 1);
});

test("reconciliación nunca aprueba referencia, monto, moneda o modo incorrectos", async () => {
  for (const invalidPayment of [
    payment({ externalReference: "RVT-FFFFFFFFFFFFFFFFFFFFFFFF" }),
    payment({ transactionAmount: 1 }),
    payment({ currencyId: "USD" }),
    payment({ liveMode: true }),
  ]) {
    let updates = 0;
    let mismatches = 0;
    const outcome = await reconcileMercadoPagoPaymentWithDependencies(invalidPayment.id, {
      gateway: {
        async createPreference() { throw new Error("unexpected preference"); },
        async getPayment() { return invalidPayment; },
      },
      findByPublicCode: async (code) => code === publicCode ? checkoutRecord() : null,
      findByPaymentId: async () => null,
      updatePayment: async (record) => { updates += 1; return record; },
      reportMismatch: () => { mismatches += 1; },
      reportUnknownStatus: () => undefined,
    });
    assert.notEqual(outcome.outcome, "UPDATED");
    assert.equal(updates, 0);
    if (invalidPayment.transactionAmount === 1 || invalidPayment.currencyId === "USD") assert.equal(mismatches, 1);
  }
});

test("reconciliación mapea pending/rejected/desconocido y no degrada APPROVED", async () => {
  for (const [providerStatus, expected] of [["pending", "PENDING"], ["rejected", "REJECTED"], ["future_unknown", "PENDING"]] as const) {
    let updatedStatus = "";
    const result = await reconcileMercadoPagoPaymentWithDependencies("987", {
      gateway: {
        async createPreference() { throw new Error("unexpected preference"); },
        async getPayment() { return payment({ status: providerStatus }); },
      },
      findByPublicCode: async () => checkoutRecord(),
      findByPaymentId: async () => null,
      updatePayment: async (record, update) => { updatedStatus = update.paymentStatus; return { ...record, paymentStatus: update.paymentStatus }; },
      reportMismatch: () => assert.fail("unexpected mismatch"),
      reportUnknownStatus: () => undefined,
    });
    assert.equal(result.outcome, "UPDATED");
    assert.equal(updatedStatus, expected);
  }
  const approved = checkoutRecord({ paymentStatus: "APPROVED", mercadoPagoPaymentId: "987", mercadoPagoStatus: "approved" });
  const regression = await reconcileMercadoPagoPaymentWithDependencies("987", {
    gateway: {
      async createPreference() { throw new Error("unexpected preference"); },
      async getPayment() { return payment({ status: "pending" }); },
    },
    findByPublicCode: async () => approved,
    findByPaymentId: async () => approved,
    updatePayment: async () => assert.fail("approved must not regress"),
    reportMismatch: () => assert.fail("unexpected mismatch"),
    reportUnknownStatus: () => assert.fail("unexpected status"),
  });
  assert.equal(regression.outcome, "STATUS_REGRESSION_IGNORED");
});

test("la consulta fallida del gateway no crea ni actualiza estados", async () => {
  let repositoryCalls = 0;
  await assert.rejects(reconcileMercadoPagoPaymentWithDependencies("404", {
    gateway: {
      async createPreference() { throw new Error("unexpected preference"); },
      async getPayment() { throw new Error("payment not found"); },
    },
    findByPublicCode: async () => { repositoryCalls += 1; return null; },
    findByPaymentId: async () => { repositoryCalls += 1; return null; },
    updatePayment: async (record) => { repositoryCalls += 1; return record; },
    reportMismatch: () => undefined,
    reportUnknownStatus: () => undefined,
  }));
  assert.equal(repositoryCalls, 0);
});

test("vista pública confirma WhatsApp solo para APPROVED y marca vencimiento", () => {
  const pending = buildPublicCheckoutView(checkoutRecord());
  assert.equal(pending?.paymentStatus, "PENDING");
  assert.equal(pending?.whatsapp, null);
  const rejected = buildPublicCheckoutView(checkoutRecord({ paymentStatus: "REJECTED" }));
  assert.equal(rejected?.whatsapp, null);
  const approved = buildPublicCheckoutView(checkoutRecord({ paymentStatus: "APPROVED" }));
  assert.match(new URL(approved!.whatsapp!.desktopWhatsappUrl).searchParams.get("text")!, /Pago confirmado/);
  const expired = buildPublicCheckoutView(checkoutRecord({ expiresAt: new Date("2026-09-09T12:00:00.000Z") }), now);
  assert.equal(expired?.paymentStatus, "EXPIRED");
  assert.equal(buildPublicCheckoutView(checkoutRecord({ totalCents: 1 })), null);
});

test("WhatsApp confirmado usa snapshot, código y las tres URLs con Unicode intacto", () => {
  const calculated = calculateOrderFromCatalog(input, catalog());
  const code = "RVT-00112233445566778899AABB";
  const message = buildConfirmedMercadoPagoMessage(calculated.lines, calculated.totalCents, code);
  assert.match(message, /💳 Forma de pago: Mercado Pago/);
  assert.match(message, /✅ Pago confirmado/);
  assert.match(message, new RegExp(code));
  const urls = buildOrderWhatsAppUrls(calculated.whatsappNumber, message);
  assert.ok(urls);
  const texts = [
    new URLSearchParams(urls.mobileWhatsappUrl.slice("whatsapp://send?".length)).get("text"),
    new URL(urls.mobileFallbackWhatsappUrl).searchParams.get("text"),
    new URL(urls.desktopWhatsappUrl).searchParams.get("text"),
  ];
  for (const text of texts) {
    assert.equal(text, message);
    assert.equal(text?.includes("�"), false);
  }
});

test("rutas usan rate limit, idempotencia, no-store y no exponen Access Token", () => {
  const createRoute = readFileSync(path.resolve("app/api/orders/mercado-pago/create/route.ts"), "utf8");
  const webhookRoute = readFileSync(path.resolve("app/api/webhooks/mercado-pago/route.ts"), "utf8");
  const statusRoute = readFileSync(path.resolve("app/api/orders/mercado-pago/status/route.ts"), "utf8");
  const cart = readFileSync(path.resolve("components/public/order/cart-provider.tsx"), "utf8");
  assert.match(createRoute, /consumePublicOrderRateLimit/);
  assert.match(createRoute, /x-idempotency-key/);
  assert.doesNotMatch(createRoute, /MERCADO_PAGO_ACCESS_TOKEN/);
  assert.match(webhookRoute, /WebhookSignatureValidator\.validate/);
  assert.match(webhookRoute, /reconcileMercadoPagoPayment/);
  assert.match(statusRoute, /cache-control.*no-store/);
  assert.match(cart, /submittingRef\.current/);
  assert.match(cart, /window\.location\.assign\(body\.initPoint\)/);
});
