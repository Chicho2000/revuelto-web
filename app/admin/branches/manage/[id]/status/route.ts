import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { branchStatusSchema, getBranchMutationError } from "@/lib/branches/schema";
import { setBranchActive } from "@/lib/branches/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const branchIdSchema = z.string().uuid();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;

  const { id } = await params;
  if (!branchIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Sucursal inválida." }, { status: 400 });
  }

  const parsed = branchStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  try {
    await setBranchActive(id, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("branches.status", error, getBranchMutationError);
  }
}
