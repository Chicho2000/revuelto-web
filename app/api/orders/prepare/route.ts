import { NextRequest, NextResponse } from "next/server";
import { prepareOrderSchema } from "@/lib/orders/schema";
import { consumePublicOrderRateLimit, getPublicOrderClientAddress } from "@/lib/orders/rate-limit";
import { preparePublicOrder, PublicOrderError } from "@/lib/orders/service";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

const MAX_REQUEST_BYTES = 32 * 1024;

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "El pedido es demasiado grande." }, { status: 413 });
  }

  const parsed = prepareOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los productos, la sucursal y la forma de pago." }, { status: 400 });
  }

  try {
    const throttle = await consumePublicOrderRateLimit(getPublicOrderClientAddress(request.headers));
    if (throttle.limited) {
      return NextResponse.json({ error: "Hiciste varios intentos. Esperá unos minutos y volvé a probar." }, { status: 429 });
    }
    const prepared = await preparePublicOrder(parsed.data);
    return NextResponse.json(prepared, {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof PublicOrderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    reportUnexpectedServerError("public-order.prepare", error);
    return NextResponse.json({ error: "No pudimos preparar el pedido. Intentá nuevamente." }, { status: 500 });
  }
}
