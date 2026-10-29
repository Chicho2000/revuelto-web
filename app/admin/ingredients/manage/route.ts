import { NextRequest, NextResponse } from "next/server";
import { ingredientFormSchema, getIngredientMutationError } from "@/lib/ingredients/schema";
import { createIngredient } from "@/lib/ingredients/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const parsed = ingredientFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos del ingrediente." }, { status: 400 });
  }
  try {
    const ingredient = await createIngredient(parsed.data);
    return NextResponse.json({ ok: true, ingredientId: ingredient.id }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse("ingredients.create", error, getIngredientMutationError);
  }
}
