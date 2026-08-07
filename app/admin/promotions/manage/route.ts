import { NextRequest, NextResponse } from "next/server";
import { getOwnerAccess } from "@/lib/auth";
import {
  getPromotionMutationError,
  promotionFormSchema,
  promotionInputFromForm,
} from "@/lib/promotions/schema";
import { createPromotion } from "@/lib/promotions/service";

export async function POST(request: NextRequest) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

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
    console.error("No se pudo crear la promoción.", error);
    const mutationError = getPromotionMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
