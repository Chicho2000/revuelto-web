import "server-only";
import type { CheckoutOrder, Prisma } from "@/generated/prisma/client";
import type { CheckoutPaymentStatus } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";

export type NewCheckoutOrder = {
  id: string;
  publicCode: string;
  clientRequestId: string;
  requestHash: string;
  branchId: string;
  subtotalCents: number;
  totalCents: number;
  itemsSnapshot: Prisma.InputJsonValue;
  mercadoPagoIdempotencyKey: string;
  expiresAt: Date;
};

export async function createOrFindCheckoutOrder(input: NewCheckoutOrder) {
  const prisma = getPrisma();
  const existing = await prisma.checkoutOrder.findUnique({ where: { clientRequestId: input.clientRequestId } });
  if (existing) return existing;

  try {
    return await prisma.checkoutOrder.create({ data: input });
  } catch (error) {
    const raced = await prisma.checkoutOrder.findUnique({ where: { clientRequestId: input.clientRequestId } });
    if (raced) return raced;
    throw error;
  }
}

export async function saveMercadoPagoPreference(id: string, preference: { id: string; initPoint: string }) {
  return getPrisma().checkoutOrder.update({
    where: { id },
    data: {
      mercadoPagoPreferenceId: preference.id,
      mercadoPagoInitPoint: preference.initPoint,
    },
  });
}

export function findCheckoutByPublicCode(publicCode: string) {
  return getPrisma().checkoutOrder.findUnique({ where: { publicCode } });
}

export function findCheckoutByPaymentId(mercadoPagoPaymentId: string) {
  return getPrisma().checkoutOrder.findUnique({ where: { mercadoPagoPaymentId } });
}

export function updateCheckoutPayment(
  checkout: CheckoutOrder,
  input: {
    paymentStatus: CheckoutPaymentStatus;
    paymentId: string;
    mercadoPagoStatus: string;
    paidAt?: Date | null;
  },
) {
  return getPrisma().checkoutOrder.update({
    where: { id: checkout.id },
    data: {
      paymentStatus: input.paymentStatus,
      mercadoPagoPaymentId: input.paymentId,
      mercadoPagoStatus: input.mercadoPagoStatus.slice(0, 100),
      ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
    },
  });
}
