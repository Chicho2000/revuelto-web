import { NextRequest, NextResponse } from "next/server";
import {
  getMerchandiseMutationError,
  merchandiseItemCreateSchema,
  merchandiseItemInputFromForm,
} from "@/lib/merchandise/schema";
import { createMerchandiseItem } from "@/lib/merchandise/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const parsed = merchandiseItemCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos y la imagen del producto.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    const item = await createMerchandiseItem(
      authorization.access.adminUser.id,
      merchandiseItemInputFromForm(parsed.data),
    );
    return NextResponse.json({ ok: true, merchandiseItemId: item.id }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse("merchandise.create", error, getMerchandiseMutationError);
  }
}
