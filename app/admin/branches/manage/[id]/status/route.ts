import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import { branchStatusSchema, getBranchMutationError } from "@/lib/branches/schema";
import { setBranchActive } from "@/lib/branches/service";

const branchIdSchema = z.string().uuid();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

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
    console.error("No se pudo cambiar el estado de la sucursal.", error);
    const mutationError = getBranchMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
