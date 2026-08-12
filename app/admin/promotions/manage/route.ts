import { NextRequest, NextResponse } from "next/server";
import {
  getPromotionMutationError,
  promotionFormSchema,
  promotionInputFromForm,
} from "@/lib/promotions/schema";
import { createPromotion } from "@/lib/promotions/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;

  const parsed = promotionFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos de la promoción.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const promotion = await createPromotion(
      access.adminUser.id,
      promotionInputFromForm(parsed.data),
    );
    return NextResponse.json({ ok: true, promotionId: promotion.id }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse("promotions.create", error, getPromotionMutationError);
  }
}
