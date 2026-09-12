import { NextRequest, NextResponse } from "next/server";
import { getPublicCheckoutView } from "@/lib/mercado-pago/checkout";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

export async function GET(request: NextRequest) {
  const publicCode = request.nextUrl.searchParams.get("code") ?? "";
  const paymentHint = request.nextUrl.searchParams.get("paymentId") ?? undefined;
  try {
    const checkout = await getPublicCheckoutView(publicCode, paymentHint);
    if (!checkout) {
      return NextResponse.json({ error: "No encontramos esta operación." }, { status: 404, headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json(checkout, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    reportUnexpectedServerError("mercado-pago.checkout-status", error);
    return NextResponse.json({ error: "No pudimos consultar el pago." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
