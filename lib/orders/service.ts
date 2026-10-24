import "server-only";
import { getSiteContent } from "@/lib/content/service";
import type { CartItem, PrepareOrderInput } from "@/lib/orders/schema";
import { getCartItemKey } from "@/lib/orders/schema";
import {
  buildOrderMessage,
  buildOrderWhatsAppUrls,
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
type CatalogRevuelto = {
  id: string;
  name: string;
  price: unknown;
  isVisibleInNewMenu: boolean;
  isArchived: boolean;
  recipeIngredients: Array<{ ingredientId: string; isRemovable: boolean; ingredient: { name: string } }>;
  choiceGroups: Array<{
    id: string;
    label: string;
    minSelections: number;
    maxSelections: number;
    options: Array<{ ingredientId: string; ingredient: { name: string } }>;
  }>;
};
type CatalogBranch = { id: string; name: string; isActive: boolean; whatsappNumber: string } | null;

export type OrderCatalog = {
  orderingEnabled: boolean;
  cashEnabled: boolean;
  transferEnabled: boolean;
  mercadoPagoEnabled: boolean;
  bowls: CatalogBowl[];
  revueltos?: CatalogRevuelto[];
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
      : catalog.mercadoPagoEnabled;
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
      sourceId: item.productId,
      name: bowl.name,
      variant: `${item.size === "SMALL" ? "Chico" : "Grande"} (${size.ounces} oz)`,
      size: item.size,
      ounces: size.ounces,
      quantity: item.quantity,
      unitPriceCents,
      subtotalCents: unitPriceCents * item.quantity,
    };
  }

  if (item.type === "REVUELTO") {
    const revuelto = catalog.revueltos?.find((candidate) => candidate.id === item.productId);
    if (!revuelto || !revuelto.isVisibleInNewMenu || revuelto.isArchived) {
      throw new PublicOrderError("ITEM_UNAVAILABLE", "Algunos productos cambiaron o ya no están disponibles. Revisá tu carrito.");
    }

    const recipeById = new Map(revuelto.recipeIngredients.map((ingredient) => [ingredient.ingredientId, ingredient]));
    const excludedIngredients = item.excludedIngredientIds.map((ingredientId) => {
      const ingredient = recipeById.get(ingredientId);
      if (!ingredient?.isRemovable) {
        throw new PublicOrderError("ITEM_UNAVAILABLE", "La personalización elegida ya no está disponible. Revisá tu carrito.");
      }
      return ingredient;
    });
    const choicesByGroup = new Map(item.choices.map((choice) => [choice.groupId, choice.ingredientIds]));
    if (choicesByGroup.size !== revuelto.choiceGroups.length) {
      throw new PublicOrderError("ITEM_UNAVAILABLE", "La personalización elegida ya no está disponible. Revisá tu carrito.");
    }
    const choiceLabels: string[] = [];
    for (const group of revuelto.choiceGroups) {
      const ingredientIds = choicesByGroup.get(group.id);
      if (!ingredientIds || ingredientIds.length < group.minSelections || ingredientIds.length > group.maxSelections) {
        throw new PublicOrderError("ITEM_UNAVAILABLE", "Completá las opciones requeridas del Revuelto.");
      }
      const options = new Map(group.options.map((option) => [option.ingredientId, option]));
      const selected = ingredientIds.map((ingredientId) => {
        const option = options.get(ingredientId);
        if (!option) throw new PublicOrderError("ITEM_UNAVAILABLE", "La personalización elegida ya no está disponible. Revisá tu carrito.");
        return option.ingredient.name;
      });
      if (selected.length > 0) choiceLabels.push(`${group.label}: ${selected.join(", ")}`);
    }
    const variantParts = [
      excludedIngredients.length > 0 ? `Sin ${excludedIngredients.map((ingredient) => ingredient.ingredient.name).join(", ")}` : null,
      ...choiceLabels,
    ].filter((value): value is string => Boolean(value));
    const unitPriceCents = moneyValueToCents(revuelto.price);
    return {
      key: getCartItemKey(item),
      type: "REVUELTO",
      sourceId: item.productId,
      name: revuelto.name,
      variant: variantParts.join(" · ") || null,
      size: null,
      ounces: 20,
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
    sourceId: item.productId,
    name: merchandise.name,
    variant: null,
    size: null,
    ounces: null,
    quantity: item.quantity,
    unitPriceCents,
    subtotalCents: unitPriceCents * item.quantity,
  };
}

export function calculateOrderFromCatalog(input: PrepareOrderInput, catalog: OrderCatalog) {
  assertPaymentAvailable(input, catalog);
  if (!catalog.branch || !catalog.branch.isActive) {
    throw new PublicOrderError("BRANCH_UNAVAILABLE", "Esta sucursal no está disponible para pedidos por WhatsApp.");
  }

  const lines = input.items.map((item) => resolveLine(item, catalog));
  const totalCents = lines.reduce((total, line) => total + line.subtotalCents, 0);
  return {
    lines,
    subtotalCents: totalCents,
    totalCents,
    branchName: catalog.branch.name,
    whatsappNumber: catalog.branch.whatsappNumber,
    paymentMethod: input.paymentMethod,
  };
}

export function prepareOrderFromCatalog(input: PrepareOrderInput, catalog: OrderCatalog) {
  const calculated = calculateOrderFromCatalog(input, catalog);
  const { lines, totalCents } = calculated;
  const message = buildOrderMessage(lines, totalCents, input.paymentMethod);
  const whatsappUrls = buildOrderWhatsAppUrls(calculated.whatsappNumber, message);
  if (!whatsappUrls) throw new PublicOrderError("BRANCH_UNAVAILABLE", "Esta sucursal no está disponible para pedidos por WhatsApp.");

  return { ...calculated, message, ...whatsappUrls };
}

export async function getPublicOrderCatalog(input: PrepareOrderInput): Promise<OrderCatalog> {
  const prisma = getPrisma();
  const bowlIds = [...new Set(input.items.filter((item) => item.type === "BOWL").map((item) => item.productId))];
  const revueltoIds = [...new Set(input.items.filter((item) => item.type === "REVUELTO").map((item) => item.productId))];
  const merchandiseIds = [...new Set(input.items.filter((item) => item.type === "MERCHANDISE").map((item) => item.productId))];
  const [content, bowls, revueltos, merchandise, branch] = await Promise.all([
    getSiteContent(),
    prisma.bowl.findMany({ where: { id: { in: bowlIds } }, select: { id: true, name: true, isAvailable: true, isArchived: true, sizes: { select: { size: true, ounces: true, price: true, isAvailable: true } } } }),
    prisma.bowl.findMany({
      where: { id: { in: revueltoIds } },
      select: {
        id: true, name: true, price: true, isVisibleInNewMenu: true, isArchived: true,
        recipeIngredients: { select: { ingredientId: true, isRemovable: true, ingredient: { select: { name: true } } } },
        choiceGroups: { select: { id: true, label: true, minSelections: true, maxSelections: true, options: { select: { ingredientId: true, ingredient: { select: { name: true } } } } } },
      },
    }),
    prisma.merchandiseItem.findMany({ where: { id: { in: merchandiseIds } }, select: { id: true, name: true, price: true, isActive: true } }),
    prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true, name: true, isActive: true, whatsappNumber: true } }),
  ]);

  return {
    orderingEnabled: content.orderingEnabled,
    cashEnabled: content.cashEnabled,
    transferEnabled: content.transferEnabled,
    mercadoPagoEnabled: content.mercadoPagoEnabled,
    bowls,
    revueltos,
    merchandise,
    branch,
  };
}

export async function preparePublicOrder(input: PrepareOrderInput) {
  return prepareOrderFromCatalog(input, await getPublicOrderCatalog(input));
}
