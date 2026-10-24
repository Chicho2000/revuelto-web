import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingredientFormSchema, getIngredientMutationError } from "@/lib/ingredients/schema";
import { updateIngredient } from "@/lib/ingredients/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { id } = await params;
  const parsed = ingredientFormSchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Revisá los datos del ingrediente." }, { status: 400 });
  }
  try {
    await updateIngredient(authorization.access.adminUser.id, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("ingredients.update", error, getIngredientMutationError);
  }
}
