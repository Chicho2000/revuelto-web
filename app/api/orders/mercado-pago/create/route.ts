import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initiateMercadoPagoCheckout, isExpectedCheckoutError, MercadoPagoCheckoutError } from "@/lib/mercado-pago/checkout";
import { prepareOrderSchema } from "@/lib/orders/schema";
import { consumePublicOrderRateLimit, getPublicOrderClientAddress } from "@/lib/orders/rate-limit";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

const MAX_REQUEST_BYTES = 32 * 1024;
const idempotencyKeySchema = z.string().uuid();

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "El pedido es demasiado grande." }, { status: 413 });
  }

  const input = prepareOrderSchema.safeParse(await request.json().catch(() => null));
  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get("x-idempotency-key"));
  if (!input.success || input.data.paymentMethod !== "MERCADO_PAGO" || !idempotencyKey.success) {
    return NextResponse.json({ error: "Revisá el pedido antes de iniciar el pago." }, { status: 400 });
  }

  try {
    const throttle = await consumePublicOrderRateLimit(getPublicOrderClientAddress(request.headers));
    if (throttle.limited) {
      return NextResponse.json({ error: "Hiciste varios intentos. Esperá unos minutos y volvé a probar." }, { status: 429 });
    }
    const checkout = await initiateMercadoPagoCheckout(input.data, idempotencyKey.data);
    return NextResponse.json(checkout, {
      headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    if (isExpectedCheckoutError(error)) {
      const publicMessage = error instanceof MercadoPagoCheckoutError
        ? "No pudimos iniciar el pago con Mercado Pago. Intentá nuevamente."
        : error.message;
      return NextResponse.json({ error: publicMessage, code: error.code }, { status: error.status });
    }
    reportUnexpectedServerError("mercado-pago.checkout-create", error);
    return NextResponse.json({ error: "No pudimos iniciar el pago con Mercado Pago. Intentá nuevamente." }, { status: 500 });
  }
}
