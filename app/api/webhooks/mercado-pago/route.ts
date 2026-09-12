import { NextRequest, NextResponse } from "next/server";
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { getMercadoPagoEnvironment } from "@/lib/env";
import { reconcileMercadoPagoPayment } from "@/lib/mercado-pago/checkout";
import { mercadoPagoNotificationSchema } from "@/lib/mercado-pago/webhook";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

const MAX_WEBHOOK_BYTES = 32 * 1024;

export async function POST(request: NextRequest) {
  const environment = getMercadoPagoEnvironment();
  if (!environment) return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
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
      return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
    }
    reportUnexpectedServerError("mercado-pago.webhook-signature", error);
    return NextResponse.json({ error: "No pudimos validar la notificación." }, { status: 500 });
  }

  const notification = mercadoPagoNotificationSchema.safeParse(await request.json().catch(() => null));
  if (!notification.success || !queryDataId || notification.data.data.id !== queryDataId) {
    return NextResponse.json({ error: "Notificación inválida." }, { status: 400 });
  }
  if (notification.data.live_mode) {
    return NextResponse.json({ received: true }, { status: 202 });
  }

  try {
    await reconcileMercadoPagoPayment(queryDataId);
    return NextResponse.json({ received: true });
  } catch (error) {
    reportUnexpectedServerError("mercado-pago.webhook-payment", error);
    return NextResponse.json({ error: "No pudimos verificar el pago." }, { status: 503 });
  }
}
