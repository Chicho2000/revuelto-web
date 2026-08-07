import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import {
  getPromotionMutationError,
  promotionFormSchema,
  promotionInputFromForm,
} from "@/lib/promotions/schema";
import { updatePromotion } from "@/lib/promotions/service";

const promotionIdSchema = z.string().uuid();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const parsed = promotionFormSchema.safeParse(await request.json().catch(() => null));
  if (!promotionIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Revisá los datos de la promoción." }, { status: 400 });
  }

  try {
    await updatePromotion(access.adminUser.id, id, promotionInputFromForm(parsed.data));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo actualizar la promoción.", error);
    const mutationError = getPromotionMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
