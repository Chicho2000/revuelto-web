import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bowlStatusSchema, getBowlMutationError } from "@/lib/bowls/schema";
import { setBowlActive } from "@/lib/bowls/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const bowlIdSchema = z.string().uuid();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;

  const { id } = await params;
  const parsedId = bowlIdSchema.safeParse(id);
  const parsedBody = bowlStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsedId.success || !parsedBody.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    await setBowlActive(id, parsedBody.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("bowls.status", error, getBowlMutationError);
  }
}
