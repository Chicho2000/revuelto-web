import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPromotionMutationError,
  promotionFormSchema,
  promotionInputFromForm,
} from "@/lib/promotions/schema";
import { updatePromotion } from "@/lib/promotions/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const promotionIdSchema = z.string().uuid();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;
  const { id } = await params;
  const parsed = promotionFormSchema.safeParse(await request.json().catch(() => null));
  if (!promotionIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Revisá los datos de la promoción." }, { status: 400 });
  }

  try {
    await updatePromotion(access.adminUser.id, id, promotionInputFromForm(parsed.data));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("promotions.update", error, getPromotionMutationError);
  }
}
