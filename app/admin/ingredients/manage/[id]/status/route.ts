import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingredientStatusSchema, getIngredientMutationError } from "@/lib/ingredients/schema";
import { setIngredientActive } from "@/lib/ingredients/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { id } = await params;
  const parsed = ingredientStatusSchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  try {
    await setIngredientActive(id, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("ingredients.status", error, getIngredientMutationError);
  }
}
