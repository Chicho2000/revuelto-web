import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMerchandiseMutationError, merchandiseItemStatusSchema } from "@/lib/merchandise/schema";
import { setMerchandiseItemActive } from "@/lib/merchandise/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const itemIdSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { id } = await params;
  const parsed = merchandiseItemStatusSchema.safeParse(await request.json().catch(() => null));
  if (!itemIdSchema.safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  try {
    await setMerchandiseItemActive(id, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("merchandise.status", error, getMerchandiseMutationError);
  }
}
