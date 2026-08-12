import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { branchDeleteSchema, branchInputSchema, getBranchMutationError } from "@/lib/branches/schema";
import { deleteBranch, updateBranch } from "@/lib/branches/service";
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;

  const { id } = await params;
  if (!branchIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Sucursal inválida." }, { status: 400 });
  }

  const parsed = branchDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribí el nombre de la sucursal para confirmarla." }, { status: 400 });
  }

  try {
    await deleteBranch(id, parsed.data.confirmation);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("branches.delete", error, getBranchMutationError);
  }
}
