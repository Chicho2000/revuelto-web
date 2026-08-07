import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import { getPromotionMutationError, promotionStatusSchema } from "@/lib/promotions/schema";
import { setPromotionActive } from "@/lib/promotions/service";

const promotionIdSchema = z.string().uuid();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const parsed = promotionStatusSchema.safeParse(await request.json().catch(() => null));
  if (!promotionIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    await setPromotionActive(id, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mutationError = getPromotionMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
