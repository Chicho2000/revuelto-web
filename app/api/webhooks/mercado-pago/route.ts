import { NextRequest, NextResponse } from "next/server";
import {
  InvalidWebhookSignatureError,
  MercadoPagoError,
  MPNotFoundError,
  WebhookSignatureValidator,
} from "mercadopago";
import { getMercadoPagoEnvironment } from "@/lib/env";
import {
  MercadoPagoCheckoutError,
  reconcileMercadoPagoPayment,
  type MercadoPagoReconcileStageEvent,
} from "@/lib/mercado-pago/checkout";
import { mercadoPagoNotificationSchema } from "@/lib/mercado-pago/webhook";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

const MAX_WEBHOOK_BYTES = 32 * 1024;
const SAFE_LOG_VALUE = /^[A-Za-z0-9._:-]{1,100}$/;

type WebhookLogDetails = {
  eventType?: string;
  liveMode?: boolean;
  paymentId?: string;
  providerStatus?: number;
  errorCode?: string;
  errorName?: string;
};

function safeLogValue(value: unknown) {
  return typeof value === "string" && SAFE_LOG_VALUE.test(value) ? value : undefined;
}

function sanitizedErrorDetails(error: unknown): WebhookLogDetails {
  const errorName = safeLogValue(error instanceof Error ? error.name : "UnknownError") ?? "UnknownError";
  if (error instanceof MercadoPagoCheckoutError) {
    return { errorName, errorCode: safeLogValue(error.code) };
  }
  if (error instanceof MercadoPagoError) {
    return {
      errorName,
      ...(error.status >= 100 && error.status <= 599 ? { providerStatus: error.status } : {}),
    };
  }
  return { errorName };
}

function logWebhookStage(stage: string, details: WebhookLogDetails = {}) {
  console.info("[mercado-pago-webhook]", { stage, ...details });
}

function logWebhookError(stage: string, details: WebhookLogDetails = {}) {
  console.error("[mercado-pago-webhook]", { stage, ...details });
}

function isRepositoryFailure(stage: MercadoPagoReconcileStageEvent["stage"] | null) {
  return stage === "MP_WEBHOOK_STAGE_ORDER_LOOKUP_FAILED" ||
    stage === "MP_WEBHOOK_STAGE_PAYMENT_OWNER_LOOKUP_FAILED" ||
    stage === "MP_WEBHOOK_STAGE_ORDER_UPDATE_FAILED";
}

export async function POST(request: NextRequest) {
  const environment = getMercadoPagoEnvironment();
  if (!environment) {
    logWebhookError("MP_WEBHOOK_CONFIG_INVALID");
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });
  }
  logWebhookStage("MP_WEBHOOK_STAGE_CONFIG_OK");

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    logWebhookError("MP_WEBHOOK_BODY_INVALID");
    return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  }

  const queryDataId = request.nextUrl.searchParams.get("data.id");
  try {
    WebhookSignatureValidator.validate({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: queryDataId,
      secret: environment.MERCADO_PAGO_WEBHOOK_SECRET,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      logWebhookError("MP_WEBHOOK_SIGNATURE_INVALID", sanitizedErrorDetails(error));
      return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
    }
    logWebhookError("MP_WEBHOOK_UNEXPECTED_ERROR", sanitizedErrorDetails(error));
    reportUnexpectedServerError("mercado-pago.webhook-signature", error);
    return NextResponse.json({ error: "No pudimos validar la notificación." }, { status: 500 });
  }
  logWebhookStage("MP_WEBHOOK_STAGE_SIGNATURE_OK");

  const notification = mercadoPagoNotificationSchema.safeParse(await request.json().catch(() => null));
  if (!notification.success || !queryDataId || notification.data.data.id !== queryDataId) {
    logWebhookError("MP_WEBHOOK_BODY_INVALID");
    return NextResponse.json({ error: "Notificación inválida." }, { status: 400 });
  }
  const eventDetails = {
    eventType: notification.data.type,
    liveMode: notification.data.live_mode,
    paymentId: queryDataId,
  } satisfies WebhookLogDetails;
  logWebhookStage("MP_WEBHOOK_STAGE_BODY_OK", eventDetails);
  if (notification.data.live_mode) {
    return NextResponse.json({ received: true }, { status: 202 });
  }

  let failedStage: MercadoPagoReconcileStageEvent["stage"] | null = null;
  try {
    logWebhookStage("MP_WEBHOOK_STAGE_RECONCILE_START", eventDetails);
    await reconcileMercadoPagoPayment(queryDataId, {
      onStage: ({ stage, error }) => {
        if (error !== undefined) {
          failedStage = stage;
          logWebhookError(stage, { ...eventDetails, ...sanitizedErrorDetails(error) });
          return;
        }
        logWebhookStage(stage, eventDetails);
      },
    });
    logWebhookStage("MP_WEBHOOK_STAGE_RECONCILE_OK", eventDetails);
    return NextResponse.json({ received: true });
  } catch (error) {
    const errorDetails = { ...eventDetails, ...sanitizedErrorDetails(error) };
    if (error instanceof MercadoPagoCheckoutError && error.code === "NOT_CONFIGURED") {
      logWebhookError("MP_WEBHOOK_CONFIG_INVALID", errorDetails);
    } else if (error instanceof MPNotFoundError) {
      logWebhookError("MP_WEBHOOK_PAYMENT_NOT_FOUND", errorDetails);
    } else if (failedStage === "MP_WEBHOOK_STAGE_PAYMENT_LOOKUP_FAILED" || error instanceof MercadoPagoError) {
      logWebhookError("MP_WEBHOOK_PROVIDER_ERROR", errorDetails);
    } else if (isRepositoryFailure(failedStage)) {
      logWebhookError("MP_WEBHOOK_REPOSITORY_ERROR", errorDetails);
    } else {
      logWebhookError("MP_WEBHOOK_UNEXPECTED_ERROR", errorDetails);
    }
    reportUnexpectedServerError("mercado-pago.webhook-payment", error);
    return NextResponse.json({ error: "No pudimos verificar el pago." }, { status: 503 });
  }
}
