import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getMerchandiseMutationError,
  merchandiseItemFormSchema,
  merchandiseItemInputFromForm,
} from "@/lib/merchandise/schema";
import { updateMerchandiseItem } from "@/lib/merchandise/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const itemIdSchema = z.string().uuid();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { id } = await params;
  const parsed = merchandiseItemFormSchema.safeParse(await request.json().catch(() => null));
  if (!itemIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Revisá los datos del producto." }, { status: 400 });
  }
  try {
    await updateMerchandiseItem(
      authorization.access.adminUser.id,
      id,
      merchandiseItemInputFromForm(parsed.data),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("merchandise.update", error, getMerchandiseMutationError);
  }
}
