import "server-only";
import { randomUUID } from "node:crypto";
import type { CheckoutOrder, Prisma } from "@/generated/prisma/client";
import type { CheckoutPaymentStatus } from "@/generated/prisma/enums";
import { getMercadoPagoEnvironment } from "@/lib/env";
import {
  buildCheckoutSnapshot,
  buildPreferenceRequest,
  canonicalCheckoutRequest,
  CHECKOUT_LIFETIME_MS,
  createPublicCheckoutCode,
  getSnapshotTotalCents,
  isKnownMercadoPagoStatus,
  mapMercadoPagoStatus,
  PUBLIC_CHECKOUT_CODE_PATTERN,
  validatePaymentForCheckout,
} from "@/lib/mercado-pago/domain";
import { createMercadoPagoGateway, isAllowedMercadoPagoCheckoutUrl } from "@/lib/mercado-pago/gateway";
import {
  createOrFindCheckoutOrder,
  findCheckoutByPaymentId,
  findCheckoutByPublicCode,
  saveMercadoPagoPreference,
  updateCheckoutPayment,
  type NewCheckoutOrder,
} from "@/lib/mercado-pago/repository";
import {
  checkoutOrderSnapshotSchema,
  type MercadoPagoGateway,
  type MercadoPagoPayment,
} from "@/lib/mercado-pago/types";
import { calculateOrderFromCatalog, getPublicOrderCatalog, PublicOrderError } from "@/lib/orders/service";
import type { OrderCatalog } from "@/lib/orders/service";
import type { PrepareOrderInput } from "@/lib/orders/schema";
import { buildConfirmedMercadoPagoMessage, buildOrderWhatsAppUrls, type PreparedOrderLine } from "@/lib/orders/whatsapp";
import { hashSecurityValue } from "@/lib/security/hmac";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

export class MercadoPagoCheckoutError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "INVALID_METHOD" | "IDEMPOTENCY_CONFLICT" | "CHECKOUT_EXPIRED" | "PROVIDER_ERROR",
    public readonly status: number,
  ) {
    super(code);
    this.name = "MercadoPagoCheckoutError";
  }
}

type InitiateCheckoutDependencies = {
  appBaseUrl: string;
  gateway: MercadoPagoGateway;
  getCatalog(input: PrepareOrderInput): Promise<OrderCatalog>;
  createOrder(input: NewCheckoutOrder): Promise<CheckoutOrder>;
  savePreference(id: string, preference: { id: string; initPoint: string }): Promise<CheckoutOrder>;
  now(): Date;
  createUuid(): string;
  createPublicCode(): string;
  hashRequest(input: PrepareOrderInput): string;
  reportProviderError(error: unknown): void;
};

export async function initiateMercadoPagoCheckoutWithDependencies(
  input: PrepareOrderInput,
  clientRequestId: string,
  dependencies: InitiateCheckoutDependencies,
) {
  if (input.paymentMethod !== "MERCADO_PAGO") throw new MercadoPagoCheckoutError("INVALID_METHOD", 400);

  const catalog = await dependencies.getCatalog(input);
  const calculated = calculateOrderFromCatalog(input, catalog);
  const snapshot = buildCheckoutSnapshot(input, calculated.lines, {
    id: input.branchId,
    name: calculated.branchName,
    whatsappNumber: calculated.whatsappNumber,
  });
  const requestHash = dependencies.hashRequest(input);
  const currentTime = dependencies.now();
  const createdAt = currentTime;
  const expiresAt = new Date(createdAt.getTime() + CHECKOUT_LIFETIME_MS);
  const checkout = await dependencies.createOrder({
    id: dependencies.createUuid(),
    publicCode: dependencies.createPublicCode(),
    clientRequestId,
    requestHash,
    branchId: input.branchId,
    subtotalCents: calculated.subtotalCents,
    totalCents: calculated.totalCents,
    itemsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    mercadoPagoIdempotencyKey: dependencies.createUuid(),
    expiresAt,
  });

  if (checkout.requestHash !== requestHash) throw new MercadoPagoCheckoutError("IDEMPOTENCY_CONFLICT", 409);
  if (checkout.expiresAt.getTime() <= currentTime.getTime()) throw new MercadoPagoCheckoutError("CHECKOUT_EXPIRED", 409);
  if (checkout.mercadoPagoInitPoint && checkout.mercadoPagoPreferenceId) {
    if (!isAllowedMercadoPagoCheckoutUrl(checkout.mercadoPagoInitPoint)) {
      throw new MercadoPagoCheckoutError("PROVIDER_ERROR", 500);
    }
    return { initPoint: checkout.mercadoPagoInitPoint };
  }

  const storedSnapshot = checkoutOrderSnapshotSchema.safeParse(checkout.itemsSnapshot);
  if (!storedSnapshot.success || getSnapshotTotalCents(storedSnapshot.data) !== checkout.totalCents) {
    throw new MercadoPagoCheckoutError("PROVIDER_ERROR", 500);
  }
  try {
    const preference = await dependencies.gateway.createPreference(
      buildPreferenceRequest(storedSnapshot.data, checkout.publicCode, dependencies.appBaseUrl, checkout.createdAt, checkout.expiresAt),
      checkout.mercadoPagoIdempotencyKey,
    );
    const saved = await dependencies.savePreference(checkout.id, preference);
    if (
      saved.mercadoPagoPreferenceId !== preference.id ||
      saved.mercadoPagoInitPoint !== preference.initPoint ||
      !isAllowedMercadoPagoCheckoutUrl(saved.mercadoPagoInitPoint)
    ) {
      throw new Error("InvalidStoredMercadoPagoPreference");
    }
    return { initPoint: saved.mercadoPagoInitPoint };
  } catch (error) {
    dependencies.reportProviderError(error);
    throw new MercadoPagoCheckoutError("PROVIDER_ERROR", 502);
  }
}

export async function initiateMercadoPagoCheckout(input: PrepareOrderInput, clientRequestId: string) {
  const environment = getMercadoPagoEnvironment();
  if (!environment) throw new MercadoPagoCheckoutError("NOT_CONFIGURED", 503);
  return initiateMercadoPagoCheckoutWithDependencies(input, clientRequestId, {
    appBaseUrl: environment.APP_BASE_URL,
    gateway: createMercadoPagoGateway(environment.MERCADO_PAGO_ACCESS_TOKEN),
    getCatalog: getPublicOrderCatalog,
    createOrder: createOrFindCheckoutOrder,
    savePreference: saveMercadoPagoPreference,
    now: () => new Date(),
    createUuid: randomUUID,
    createPublicCode: createPublicCheckoutCode,
    hashRequest: (checkoutInput) => hashSecurityValue("mercado-pago-checkout", canonicalCheckoutRequest(checkoutInput)),
    reportProviderError: (error) => reportUnexpectedServerError("mercado-pago.preference", error),
  });
}

function safePaidAt(value: string | null) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

type ReconcilePaymentDependencies = {
  gateway: MercadoPagoGateway;
  findByPublicCode(publicCode: string): Promise<CheckoutOrder | null>;
  findByPaymentId(paymentId: string): Promise<CheckoutOrder | null>;
  updatePayment(checkout: CheckoutOrder, input: {
    paymentStatus: CheckoutPaymentStatus;
    paymentId: string;
    mercadoPagoStatus: string;
    paidAt?: Date | null;
  }): Promise<CheckoutOrder>;
  reportMismatch(error: Error): void;
  reportUnknownStatus(status: string): void;
  onStage?(event: MercadoPagoReconcileStageEvent): void;
};

export type MercadoPagoReconcileStageEvent = {
  stage:
    | "MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_START"
    | "MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_FAILED"
    | "MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_OK"
    | "MP_WEBHOOK_STAGE_ORDER_LOOKUP_START"
    | "MP_WEBHOOK_STAGE_ORDER_LOOKUP_FAILED"
    | "MP_WEBHOOK_STAGE_ORDER_LOOKUP_OK"
    | "MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_START"
    | "MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_FAILED"
    | "MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_OK"
    | "MP_WEBHOOK_STAGE_ORDER_UPDATE_START"
    | "MP_WEBHOOK_STAGE_ORDER_UPDATE_FAILED"
    | "MP_WEBHOOK_STAGE_ORDER_UPDATE_OK";
  error?: unknown;
};

export type MercadoPagoReturnStageEvent = {
  stage:
    | "MP_RETURN_CODE_INVALID"
    | "MP_RETURN_CODE_OK"
    | "MP_RETURN_PAYMENT_ID_MISSING_OR_INVALID"
    | "MP_RETURN_PAYMENT_ID_PRESENT"
    | "MP_RETURN_ORDER_LOOKUP_START"
    | "MP_RETURN_ORDER_LOOKUP_FAILED"
    | "MP_RETURN_ORDER_FOUND"
    | "MP_RETURN_ORDER_NOT_FOUND"
    | "MP_RETURN_PAYMENT_LOOKUP_START"
    | "MP_RETURN_PAYMENT_LOOKUP_FAILED"
    | "MP_RETURN_PAYMENT_LOOKUP_OK"
    | "MP_RETURN_RECONCILE_ORDER_LOOKUP_START"
    | "MP_RETURN_RECONCILE_ORDER_LOOKUP_FAILED"
    | "MP_RETURN_RECONCILE_ORDER_LOOKUP_OK"
    | "MP_RETURN_PAYMENT_OWNER_LOOKUP_START"
    | "MP_RETURN_PAYMENT_OWNER_LOOKUP_FAILED"
    | "MP_RETURN_PAYMENT_OWNER_LOOKUP_OK"
    | "MP_RETURN_ORDER_UPDATE_START"
    | "MP_RETURN_ORDER_UPDATE_FAILED"
    | "MP_RETURN_ORDER_UPDATE_OK"
    | "MP_RETURN_RECONCILE_START"
    | "MP_RETURN_RECONCILE_FAILED"
    | "MP_RETURN_RECONCILE_OK"
    | "MP_RETURN_ORDER_RELOAD_START"
    | "MP_RETURN_ORDER_RELOAD_FAILED"
    | "MP_RETURN_ORDER_RELOAD_OK";
  paymentId?: string;
  error?: unknown;
  failureKind?: "PROVIDER" | "REPOSITORY";
};

const returnReconcileStageMap: Record<
  MercadoPagoReconcileStageEvent["stage"],
  MercadoPagoReturnStageEvent["stage"]
> = {
  MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_START: "MP_RETURN_PAYMENT_LOOKUP_START",
  MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_FAILED: "MP_RETURN_PAYMENT_LOOKUP_FAILED",
  MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_OK: "MP_RETURN_PAYMENT_LOOKUP_OK",
  MP_WEBHOOK_STAGE_ORDER_LOOKUP_START: "MP_RETURN_RECONCILE_ORDER_LOOKUP_START",
  MP_WEBHOOK_STAGE_ORDER_LOOKUP_FAILED: "MP_RETURN_RECONCILE_ORDER_LOOKUP_FAILED",
  MP_WEBHOOK_STAGE_ORDER_LOOKUP_OK: "MP_RETURN_RECONCILE_ORDER_LOOKUP_OK",
  MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_START: "MP_RETURN_PAYMENT_OWNER_LOOKUP_START",
  MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_FAILED: "MP_RETURN_PAYMENT_OWNER_LOOKUP_FAILED",
  MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_OK: "MP_RETURN_PAYMENT_OWNER_LOOKUP_OK",
  MP_WEBHOOK_STAGE_ORDER_UPDATE_START: "MP_RETURN_ORDER_UPDATE_START",
  MP_WEBHOOK_STAGE_ORDER_UPDATE_FAILED: "MP_RETURN_ORDER_UPDATE_FAILED",
  MP_WEBHOOK_STAGE_ORDER_UPDATE_OK: "MP_RETURN_ORDER_UPDATE_OK",
};

export async function reconcileMercadoPagoPaymentWithDependencies(
  paymentId: string,
  dependencies: ReconcilePaymentDependencies,
) {
  dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_START" });
  let payment: MercadoPagoPayment;
  try {
    payment = await dependencies.gateway.getPayment(paymentId);
  } catch (error) {
    dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_FAILED", error });
    throw error;
  }
  dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_OK" });
  if (!PUBLIC_CHECKOUT_CODE_PATTERN.test(payment.externalReference)) return { outcome: "IGNORED" as const };

  dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_ORDER_LOOKUP_START" });
  let checkout: CheckoutOrder | null;
  try {
    checkout = await dependencies.findByPublicCode(payment.externalReference);
  } catch (error) {
    dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_ORDER_LOOKUP_FAILED", error });
    throw error;
  }
  dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_ORDER_LOOKUP_OK" });
  if (!checkout) return { outcome: "IGNORED" as const };
  const validation = validatePaymentForCheckout(payment, checkout);
  if (!validation.externalReferenceMatches || !validation.testModeMatches) return { outcome: "IGNORED" as const };

  dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_START" });
  let paymentOwner: CheckoutOrder | null;
  try {
    paymentOwner = await dependencies.findByPaymentId(payment.id);
  } catch (error) {
    dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_FAILED", error });
    throw error;
  }
  dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_OK" });
  if (paymentOwner && paymentOwner.id !== checkout.id) return { outcome: "IGNORED" as const };
  if (checkout.paymentStatus === "APPROVED" && checkout.mercadoPagoPaymentId !== payment.id) {
    return { outcome: "DUPLICATE_ATTEMPT" as const };
  }

  const nextStatus = mapMercadoPagoStatus(payment.status);
  if (!isKnownMercadoPagoStatus(payment.status)) dependencies.reportUnknownStatus(payment.status.slice(0, 100));
  if (nextStatus === "APPROVED" && (!validation.amountMatches || !validation.currencyMatches)) {
    dependencies.reportMismatch(new Error("MercadoPagoPaymentMismatch"));
    return { outcome: "AMOUNT_OR_CURRENCY_MISMATCH" as const };
  }
  if (checkout.paymentStatus === "APPROVED" && nextStatus !== "APPROVED" && nextStatus !== "REFUNDED") {
    return { outcome: "STATUS_REGRESSION_IGNORED" as const, checkout };
  }
  if (
    checkout.mercadoPagoPaymentId === payment.id &&
    checkout.paymentStatus === nextStatus &&
    checkout.mercadoPagoStatus === payment.status
  ) {
    return { outcome: "ALREADY_PROCESSED" as const, checkout };
  }

  dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_ORDER_UPDATE_START" });
  let updated: CheckoutOrder;
  try {
    updated = await dependencies.updatePayment(checkout, {
      paymentStatus: nextStatus,
      paymentId: payment.id,
      mercadoPagoStatus: payment.status,
      ...(nextStatus === "APPROVED" ? { paidAt: safePaidAt(payment.dateApproved) } : {}),
    });
  } catch (error) {
    dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_ORDER_UPDATE_FAILED", error });
    throw error;
  }
  dependencies.onStage?.({ stage: "MP_WEBHOOK_STAGE_ORDER_UPDATE_OK" });
  return { outcome: "UPDATED" as const, checkout: updated };
}

export async function reconcileMercadoPagoPayment(
  paymentId: string,
  options: { gateway?: MercadoPagoGateway; onStage?(event: MercadoPagoReconcileStageEvent): void } = {},
) {
  const environment = getMercadoPagoEnvironment();
  if (!environment) throw new MercadoPagoCheckoutError("NOT_CONFIGURED", 503);
  return reconcileMercadoPagoPaymentWithDependencies(paymentId, {
    gateway: options.gateway ?? createMercadoPagoGateway(environment.MERCADO_PAGO_ACCESS_TOKEN),
    findByPublicCode: findCheckoutByPublicCode,
    findByPaymentId: findCheckoutByPaymentId,
    updatePayment: updateCheckoutPayment,
    reportMismatch: (error) => reportUnexpectedServerError("mercado-pago.payment-mismatch", error),
    reportUnknownStatus: () => reportUnexpectedServerError("mercado-pago.unknown-payment-status", new Error("UnknownMercadoPagoPaymentStatus")),
    onStage: options.onStage,
  });
}

function snapshotLines(snapshot: ReturnType<typeof checkoutOrderSnapshotSchema.parse>): PreparedOrderLine[] {
  return snapshot.items.map((item) => ({
    key: item.type === "BOWL" ? `BOWL:${item.sourceId}:${item.size}` : `MERCHANDISE:${item.sourceId}`,
    type: item.type,
    sourceId: item.sourceId,
    name: item.name,
    variant: item.type === "BOWL" ? `${item.size === "SMALL" ? "Chico" : "Grande"} (${item.ounces} oz)` : null,
    size: item.type === "BOWL" ? item.size : null,
    ounces: item.type === "BOWL" ? item.ounces : null,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    subtotalCents: item.subtotalCents,
  }));
}

export type PublicCheckoutView = Awaited<ReturnType<typeof getPublicCheckoutView>>;

export function buildPublicCheckoutView(checkout: CheckoutOrder, now = new Date()) {
  const snapshot = checkoutOrderSnapshotSchema.safeParse(checkout.itemsSnapshot);
  if (!snapshot.success || getSnapshotTotalCents(snapshot.data) !== checkout.totalCents) return null;
  const lines = snapshotLines(snapshot.data);
  const expired = checkout.paymentStatus === "PENDING" && checkout.expiresAt.getTime() <= now.getTime();
  const whatsapp = checkout.paymentStatus === "APPROVED"
    ? buildOrderWhatsAppUrls(
        snapshot.data.branch.whatsappNumber,
        buildConfirmedMercadoPagoMessage(lines, checkout.totalCents, checkout.publicCode),
      )
    : null;

  return {
    publicCode: checkout.publicCode,
    branchName: snapshot.data.branch.name,
    paymentStatus: expired ? "EXPIRED" as const : checkout.paymentStatus,
    totalCents: checkout.totalCents,
    lines: lines.map(({ key, name, variant, quantity, subtotalCents }) => ({ key, name, variant, quantity, subtotalCents })),
    whatsapp,
  };
}

export async function getPublicCheckoutView(
  publicCode: string,
  paymentHint?: string,
  onStage?: (event: MercadoPagoReturnStageEvent) => void,
) {
  if (!PUBLIC_CHECKOUT_CODE_PATTERN.test(publicCode)) {
    onStage?.({ stage: "MP_RETURN_CODE_INVALID" });
    return null;
  }
  onStage?.({ stage: "MP_RETURN_CODE_OK" });

  onStage?.({ stage: "MP_RETURN_ORDER_LOOKUP_START" });
  let initialCheckout: CheckoutOrder | null;
  try {
    initialCheckout = await findCheckoutByPublicCode(publicCode);
  } catch (error) {
    onStage?.({ stage: "MP_RETURN_ORDER_LOOKUP_FAILED", error });
    throw error;
  }
  if (!initialCheckout) {
    onStage?.({ stage: "MP_RETURN_ORDER_NOT_FOUND" });
    return null;
  }
  onStage?.({ stage: "MP_RETURN_ORDER_FOUND" });

  if (paymentHint && /^\d{1,30}$/.test(paymentHint)) {
    onStage?.({ stage: "MP_RETURN_PAYMENT_ID_PRESENT", paymentId: paymentHint });
    onStage?.({ stage: "MP_RETURN_RECONCILE_START", paymentId: paymentHint });
    let failureKind: MercadoPagoReturnStageEvent["failureKind"];
    try {
      await reconcileMercadoPagoPayment(paymentHint, {
        onStage: ({ stage, error }) => {
          const returnStage = returnReconcileStageMap[stage];
          if (error !== undefined) {
            failureKind = returnStage === "MP_RETURN_PAYMENT_LOOKUP_FAILED"
              ? "PROVIDER"
              : "REPOSITORY";
          }
          onStage?.({ stage: returnStage, paymentId: paymentHint, error });
        },
      });
      onStage?.({ stage: "MP_RETURN_RECONCILE_OK", paymentId: paymentHint });
    } catch (error) {
      onStage?.({
        stage: "MP_RETURN_RECONCILE_FAILED",
        paymentId: paymentHint,
        error,
        failureKind,
      });
    }
  } else {
    onStage?.({ stage: "MP_RETURN_PAYMENT_ID_MISSING_OR_INVALID" });
  }

  onStage?.({ stage: "MP_RETURN_ORDER_RELOAD_START" });
  let checkout: CheckoutOrder | null;
  try {
    checkout = await findCheckoutByPublicCode(publicCode);
  } catch (error) {
    onStage?.({ stage: "MP_RETURN_ORDER_RELOAD_FAILED", error });
    throw error;
  }
  if (!checkout) return null;
  onStage?.({ stage: "MP_RETURN_ORDER_RELOAD_OK" });
  return buildPublicCheckoutView(checkout);
}

export function isExpectedCheckoutError(error: unknown): error is MercadoPagoCheckoutError | PublicOrderError {
  return error instanceof MercadoPagoCheckoutError || error instanceof PublicOrderError;
}
