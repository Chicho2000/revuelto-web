import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPromotionMutationError, promotionStatusSchema } from "@/lib/promotions/schema";
import { setPromotionActive } from "@/lib/promotions/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const promotionIdSchema = z.string().uuid();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { id } = await params;
  const parsed = promotionStatusSchema.safeParse(await request.json().catch(() => null));
  if (!promotionIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    await setPromotionActive(id, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("promotions.status", error, getPromotionMutationError);
  }
}
