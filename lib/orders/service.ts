import "server-only";
import { getSiteContent } from "@/lib/content/service";
import type { CartItem, PrepareOrderInput } from "@/lib/orders/schema";
import { getCartItemKey } from "@/lib/orders/schema";
import {
  buildOrderMessage,
  buildOrderWhatsAppUrl,
  type PreparedOrderLine,
} from "@/lib/orders/whatsapp";
import { getPrisma } from "@/lib/prisma";

type CatalogBowl = {
  id: string;
  name: string;
  isAvailable: boolean;
  isArchived: boolean;
  sizes: Array<{ size: "SMALL" | "LARGE"; ounces: number; price: unknown; isAvailable: boolean }>;
};

type CatalogMerchandise = { id: string; name: string; price: unknown; isActive: boolean };
type CatalogBranch = { id: string; name: string; isActive: boolean; whatsappNumber: string } | null;

export type OrderCatalog = {
  orderingEnabled: boolean;
  cashEnabled: boolean;
  transferEnabled: boolean;
  mercadoPagoEnabled: boolean;
  bowls: CatalogBowl[];
  merchandise: CatalogMerchandise[];
  branch: CatalogBranch;
};

export class PublicOrderError extends Error {
  constructor(
    public readonly code: "ORDERING_DISABLED" | "PAYMENT_UNAVAILABLE" | "BRANCH_UNAVAILABLE" | "ITEM_UNAVAILABLE" | "INVALID_PRICE",
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "PublicOrderError";
  }
}

export function moneyValueToCents(value: unknown) {
  const normalized = typeof value === "object" && value !== null && "toFixed" in value
    ? (value as { toFixed: (digits: number) => string }).toFixed(2)
    : String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new PublicOrderError("INVALID_PRICE", "No pudimos validar el precio de un producto.");
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new PublicOrderError("INVALID_PRICE", "No pudimos validar el precio de un producto.");
  return cents;
}

function assertPaymentAvailable(input: PrepareOrderInput, catalog: OrderCatalog) {
  if (!catalog.orderingEnabled) throw new PublicOrderError("ORDERING_DISABLED", "Los pedidos web no están disponibles en este momento.");
  const enabled = input.paymentMethod === "CASH"
    ? catalog.cashEnabled
    : input.paymentMethod === "TRANSFER"
      ? catalog.transferEnabled
      : false;
  if (!enabled) throw new PublicOrderError("PAYMENT_UNAVAILABLE", "La forma de pago seleccionada no está disponible.");
}

function resolveLine(item: CartItem, catalog: OrderCatalog): PreparedOrderLine {
  if (item.type === "BOWL") {
    const bowl = catalog.bowls.find((candidate) => candidate.id === item.productId);
    const size = bowl?.sizes.find((candidate) => candidate.size === item.size);
    if (!bowl || !bowl.isAvailable || bowl.isArchived || !size || !size.isAvailable) {
      throw new PublicOrderError("ITEM_UNAVAILABLE", "Algunos productos cambiaron o ya no están disponibles. Revisá tu carrito.");
    }
    const unitPriceCents = moneyValueToCents(size.price);
    return {
      key: getCartItemKey(item),
      type: "BOWL",
      name: bowl.name,
      variant: `${item.size === "SMALL" ? "Chico" : "Grande"} (${size.ounces} oz)`,
      quantity: item.quantity,
      unitPriceCents,
      subtotalCents: unitPriceCents * item.quantity,
    };
  }

  const merchandise = catalog.merchandise.find((candidate) => candidate.id === item.productId);
  if (!merchandise || !merchandise.isActive) {
    throw new PublicOrderError("ITEM_UNAVAILABLE", "Algunos productos cambiaron o ya no están disponibles. Revisá tu carrito.");
  }
  const unitPriceCents = moneyValueToCents(merchandise.price);
  return {
    key: getCartItemKey(item),
    type: "MERCHANDISE",
    name: merchandise.name,
    variant: null,
    quantity: item.quantity,
    unitPriceCents,
    subtotalCents: unitPriceCents * item.quantity,
  };
}

export function prepareOrderFromCatalog(input: PrepareOrderInput, catalog: OrderCatalog) {
  assertPaymentAvailable(input, catalog);
  if (!catalog.branch || !catalog.branch.isActive) {
    throw new PublicOrderError("BRANCH_UNAVAILABLE", "Esta sucursal no está disponible para pedidos por WhatsApp.");
  }

  const lines = input.items.map((item) => resolveLine(item, catalog));
  const totalCents = lines.reduce((total, line) => total + line.subtotalCents, 0);
  const message = buildOrderMessage(lines, totalCents, input.paymentMethod);
  const whatsappUrl = buildOrderWhatsAppUrl(catalog.branch.whatsappNumber, message);
  if (!whatsappUrl) throw new PublicOrderError("BRANCH_UNAVAILABLE", "Esta sucursal no está disponible para pedidos por WhatsApp.");

  return { lines, totalCents, message, whatsappUrl, branchName: catalog.branch.name, paymentMethod: input.paymentMethod };
}

export async function preparePublicOrder(input: PrepareOrderInput) {
  const prisma = getPrisma();
  const bowlIds = [...new Set(input.items.filter((item) => item.type === "BOWL").map((item) => item.productId))];
  const merchandiseIds = [...new Set(input.items.filter((item) => item.type === "MERCHANDISE").map((item) => item.productId))];
  const [content, bowls, merchandise, branch] = await Promise.all([
    getSiteContent(),
    prisma.bowl.findMany({ where: { id: { in: bowlIds } }, select: { id: true, name: true, isAvailable: true, isArchived: true, sizes: { select: { size: true, ounces: true, price: true, isAvailable: true } } } }),
    prisma.merchandiseItem.findMany({ where: { id: { in: merchandiseIds } }, select: { id: true, name: true, price: true, isActive: true } }),
    prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true, name: true, isActive: true, whatsappNumber: true } }),
  ]);

  return prepareOrderFromCatalog(input, {
    orderingEnabled: content.orderingEnabled,
    cashEnabled: content.cashEnabled,
    transferEnabled: content.transferEnabled,
    mercadoPagoEnabled: content.mercadoPagoEnabled,
    bowls,
    merchandise,
    branch,
  });
}
