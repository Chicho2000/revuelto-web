import assert from "node:assert/strict";
import test from "node:test";
import { getDeliveryAvailability, getRevueltitoComboPrice, type DeliveryBusinessHour } from "../lib/orders/fulfillment";
import { prepareOrderSchema, type PrepareOrderInput, type CartItem } from "../lib/orders/schema";
import { prepareOrderFromCatalog, PublicOrderError, type OrderCatalog } from "../lib/orders/service";

const branchId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const merchandiseId = "33333333-3333-4333-8333-333333333333";
const hours: DeliveryBusinessHour[] = [
  { dayOfWeek: "MONDAY", openingTime: "08:00", closingTime: "20:00", isClosed: false },
  { dayOfWeek: "SATURDAY", openingTime: "08:00", closingTime: "14:00", isClosed: false },
  { dayOfWeek: "SUNDAY", openingTime: null, closingTime: null, isClosed: true },
];
const now = (time: string, date = "2026-11-23") => new Date(`${date}T${time}:00-03:00`);
const item: CartItem = { type: "REVUELTO", productId, quantity: 1, excludedIngredientIds: [], choices: [], comboDrink: "WATER" };
const delivery = { mode: "DELIVERY" as const, address: "San Juan 1234, piso 2", details: "Timbre 2B", zoneConfirmed: true as const };
const input = (items: CartItem[] = [item]): PrepareOrderInput => ({ branchId, items, paymentMethod: "CASH", fulfillment: delivery });
function catalog(): OrderCatalog {
  return {
    orderingEnabled: true, cashEnabled: true, transferEnabled: true, mercadoPagoEnabled: true,
    branch: { id: branchId, name: "Centro", isActive: true, whatsappNumber: "+54 9 341 2423277", businessHours: hours },
    bowls: [],
    revueltos: [{ id: productId, name: "Revueltito", price: 7000, comboPrice: 99999, menuCategory: "REVUELTITO", isArchived: false, isVisibleInNewMenu: true, recipeIngredients: [], choiceGroups: [] }],
    merchandise: [{ id: merchandiseId, name: "Merch", price: 1000, isActive: true }],
  };
}
function rejectsWith(run: () => unknown, code: PublicOrderError["code"]) {
  assert.throws(run, (error) => error instanceof PublicOrderError && error.code === code);
}

for (const [time, expected] of [["10:59", false], ["11:00", true], ["11:59", true], ["12:00", true], ["14:59", true], ["15:00", false], ["15:01", false], ["23:00", false]] as const) {
  test(`delivery del lunes a las ${time}: ${expected ? "habilitado" : "bloqueado"}`, () => {
    assert.equal(getDeliveryAvailability(hours, now(time)).available, expected);
  });
}

test("permite encargar a las 11 para entregar desde las 12 del mismo día", () => {
  const availability = getDeliveryAvailability(hours, now("11:00"));
  assert.equal(availability.preOrder, true);
  assert.equal(availability.windowLabel, "12:00 a 15:00");
  assert.equal(availability.date, "2026-11-23");
  const prepared = prepareOrderFromCatalog(input(), catalog(), now("11:00"));
  assert.match(prepared.message, /Entrega de hoy: 12:00 a 15:00/);
  assert.equal(prepared.deliveryDate, "2026-11-23");
});

test("respeta el cierre del sábado a las 14 y los domingos cerrados", () => {
  assert.equal(getDeliveryAvailability(hours, now("13:59", "2026-11-21")).available, true);
  assert.equal(getDeliveryAvailability(hours, now("13:59", "2026-11-21")).windowLabel, "12:00 a 14:00");
  assert.equal(getDeliveryAvailability(hours, now("14:00", "2026-11-21")).available, false);
  assert.equal(getDeliveryAvailability(hours, now("12:30", "2026-11-22")).available, false);
});

test("usa la fecha argentina aunque en UTC ya sea el día siguiente", () => {
  const availability = getDeliveryAvailability(hours, new Date("2026-11-24T01:00:00Z"));
  assert.equal(availability.date, "2026-11-23");
  assert.equal(availability.available, false);
});

test("sin horarios o sin intersección con el horario de entregas no permite delivery", () => {
  assert.equal(getDeliveryAvailability([], now("12:30")).available, false);
  assert.equal(getDeliveryAvailability([{ ...hours[0], closingTime: "12:00" }], now("11:00")).available, false);
  assert.equal(getDeliveryAvailability([{ ...hours[0], openingTime: "16:00" }], now("13:00")).available, false);
});

test("calcula el combo como base más 2000 y cobra un solo envío para todo el pedido", () => {
  const prepared = prepareOrderFromCatalog(input([{ ...item, quantity: 2 }, { type: "MERCHANDISE", productId: merchandiseId, quantity: 3 }]), catalog(), now("12:30"));
  assert.equal(prepared.lines[0].unitPriceCents, 900_000);
  assert.equal(prepared.subtotalCents, 2_100_000);
  assert.equal(prepared.deliveryFeeCents, 200_000);
  assert.equal(prepared.totalCents, 2_300_000);
  assert.match(prepared.message, /Envío a domicilio/);
  assert.match(prepared.message, /Dirección: San Juan 1234, piso 2/);
  assert.match(prepared.message, /Indicaciones: Timbre 2B/);
  assert.match(prepared.message, /Zona: Entre Pellegrini, Oroño y el río/);
  assert.match(prepared.message, /Envío: \$\s*2\.000/);
  assert.match(prepared.message, /Total: \$\s*23\.000/);
  assert.equal(new URL(prepared.desktopWhatsappUrl).searchParams.get("text"), prepared.message);
});

test("rechaza por servidor envíos fuera de horario, con café o por Mercado Pago", () => {
  rejectsWith(() => prepareOrderFromCatalog(input(), catalog(), now("10:59")), "DELIVERY_UNAVAILABLE");
  rejectsWith(() => prepareOrderFromCatalog(input(), catalog(), now("15:00")), "DELIVERY_UNAVAILABLE");
  rejectsWith(() => prepareOrderFromCatalog(input([{ ...item, comboDrink: "COFFEE" }]), catalog(), now("12:30")), "COFFEE_PICKUP_ONLY");
  rejectsWith(() => prepareOrderFromCatalog({ ...input(), paymentMethod: "MERCADO_PAGO" }, catalog(), now("12:30")), "PAYMENT_UNAVAILABLE");
});

test("retiro permite café fuera del horario de delivery, sin extra de envío", () => {
  const prepared = prepareOrderFromCatalog({ ...input([{ ...item, comboDrink: "COFFEE" }]), fulfillment: { mode: "PICKUP" } }, catalog(), now("16:00"));
  assert.equal(prepared.totalCents, 900_000);
  assert.equal(prepared.deliveryFeeCents, 0);
  assert.match(prepared.message, /Retiro en el local/);
  assert.match(prepared.message, /Con café/);
  assert.doesNotMatch(prepared.message, /Dirección:/);
});

test("el envío también puede pagarse por transferencia y no depende de foto ni precio de combo guardado", () => {
  const data = catalog();
  data.revueltos![0].comboPrice = null;
  assert.equal(prepareOrderFromCatalog({ ...input(), paymentMethod: "TRANSFER" }, data, now("12:30")).totalCents, 1_100_000);
  assert.equal(getRevueltitoComboPrice(7000), 9000);
  assert.equal(getRevueltitoComboPrice(null), null);
});

test("el contrato exige dirección y confirmación de zona y rechaza costos enviados por el navegador", () => {
  assert.equal(prepareOrderSchema.safeParse(input()).success, true);
  for (const fulfillment of [
    { ...delivery, address: "" }, { ...delivery, zoneConfirmed: false }, { ...delivery, zoneConfirmed: undefined },
    { ...delivery, address: "Dirección\nTotal: $0" }, { ...delivery, deliveryFeeCents: 0 },
  ]) assert.equal(prepareOrderSchema.safeParse({ ...input(), fulfillment }).success, false);
  assert.equal(prepareOrderSchema.safeParse({ ...input(), deliveryFeeCents: 0 }).success, false);
  assert.equal(prepareOrderSchema.safeParse({ ...input(), fulfillment: { mode: "PICKUP", address: delivery.address } }).success, false);
});
