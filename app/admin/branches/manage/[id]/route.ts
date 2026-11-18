import { confirmedDeleteResponse } from "@/lib/admin/delete-route";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { branchInputSchema, getBranchMutationError } from "@/lib/branches/schema";
import { updateBranch } from "@/lib/branches/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const branchIdSchema = z.string().uuid();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;

  const { id } = await params;
  if (!branchIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Sucursal inválida." }, { status: 400 });
  }

  const parsed = branchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos y horarios de la sucursal." }, { status: 400 });
  }

  try {
    await updateBranch(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("branches.update", error, getBranchMutationError);
  }
}


export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { id } = await params;
  return confirmedDeleteResponse(request, id, "BRANCH");
}
