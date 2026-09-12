import { randomBytes } from "node:crypto";
import type { PrepareOrderInput } from "@/lib/orders/schema";
import type { PreparedOrderLine } from "@/lib/orders/whatsapp";
import type { CheckoutOrderSnapshot, MercadoPagoPayment, MercadoPagoPreferenceRequest } from "@/lib/mercado-pago/types";

export const CHECKOUT_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const PUBLIC_CHECKOUT_CODE_PATTERN = /^RVT-[A-F0-9]{24}$/;

export function createPublicCheckoutCode() {
  return `RVT-${randomBytes(12).toString("hex").toUpperCase()}`;
}

export function canonicalCheckoutRequest(input: PrepareOrderInput) {
  const items = [...input.items]
    .map((item) => item.type === "BOWL"
      ? { type: item.type, productId: item.productId, size: item.size, quantity: item.quantity }
      : { type: item.type, productId: item.productId, quantity: item.quantity })
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify({ branchId: input.branchId, paymentMethod: input.paymentMethod, items });
}

export function buildCheckoutSnapshot(
  input: PrepareOrderInput,
  lines: readonly PreparedOrderLine[],
  branch: { id: string; name: string; whatsappNumber: string },
): CheckoutOrderSnapshot {
  return {
    version: 1,
    branch,
    items: lines.map((line, index) => {
      const item = input.items[index];
      if (line.type === "BOWL" && item.type === "BOWL") {
        return {
          type: "BOWL",
          sourceId: line.sourceId,
          name: line.name,
          size: item.size,
          ounces: line.ounces!,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          subtotalCents: line.subtotalCents,
        };
      }
      return {
        type: "MERCHANDISE",
        sourceId: line.sourceId,
        name: line.name,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        subtotalCents: line.subtotalCents,
      };
    }),
  };
}

function appendCode(baseUrl: string, path: string, publicCode: string) {
  const url = new URL(path, `${baseUrl}/`);
  url.searchParams.set("code", publicCode);
  return url.toString();
}

export function buildCheckoutBackUrls(baseUrl: string, publicCode: string) {
  return {
    success: appendCode(baseUrl, "/checkout/mercado-pago/success", publicCode),
    pending: appendCode(baseUrl, "/checkout/mercado-pago/pending", publicCode),
    failure: appendCode(baseUrl, "/checkout/mercado-pago/failure", publicCode),
  };
}

export function centsToMercadoPagoAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("InvalidCheckoutAmount");
  return Number((cents / 100).toFixed(2));
}

export function buildPreferenceRequest(
  snapshot: CheckoutOrderSnapshot,
  publicCode: string,
  baseUrl: string,
  createdAt: Date,
  expiresAt: Date,
): MercadoPagoPreferenceRequest {
  return {
    items: snapshot.items.map((item) => ({
      id: item.type === "BOWL" ? `${item.sourceId}:${item.size}` : item.sourceId,
      title: item.type === "BOWL" ? `${item.name} — ${item.size === "SMALL" ? "Chico" : "Grande"} (${item.ounces} oz)` : item.name,
      quantity: item.quantity,
      unit_price: centsToMercadoPagoAmount(item.unitPriceCents),
      currency_id: "ARS",
    })),
    external_reference: publicCode,
    back_urls: buildCheckoutBackUrls(baseUrl, publicCode),
    auto_return: "approved",
    expires: true,
    expiration_date_from: createdAt.toISOString(),
    expiration_date_to: expiresAt.toISOString(),
  };
}

export function getSnapshotTotalCents(snapshot: CheckoutOrderSnapshot) {
  const total = snapshot.items.reduce((sum, item) => sum + item.subtotalCents, 0);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

export function mercadoPagoAmountToCents(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const scaled = amount * 100;
  const cents = Math.round(scaled);
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) < 1e-6 ? cents : null;
}

export function mapMercadoPagoStatus(status: string) {
  switch (status.toLowerCase()) {
    case "approved": return "APPROVED" as const;
    case "rejected": return "REJECTED" as const;
    case "cancelled": return "CANCELLED" as const;
    case "refunded":
    case "charged_back": return "REFUNDED" as const;
    case "pending":
    case "in_process":
    case "in_mediation":
    case "authorized": return "PENDING" as const;
    default: return "PENDING" as const;
  }
}

export function isKnownMercadoPagoStatus(status: string) {
  return ["approved", "rejected", "cancelled", "refunded", "charged_back", "pending", "in_process", "in_mediation", "authorized"]
    .includes(status.toLowerCase());
}

export function validatePaymentForCheckout(
  payment: MercadoPagoPayment,
  checkout: { publicCode: string; totalCents: number },
) {
  return {
    externalReferenceMatches: payment.externalReference === checkout.publicCode,
    amountMatches: mercadoPagoAmountToCents(payment.transactionAmount) === checkout.totalCents,
    currencyMatches: payment.currencyId === "ARS",
    testModeMatches: payment.liveMode === false,
  };
}
