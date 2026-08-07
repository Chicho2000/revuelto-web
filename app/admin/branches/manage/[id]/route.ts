import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import { branchDeleteSchema, branchInputSchema, getBranchMutationError } from "@/lib/branches/schema";
import { deleteBranch, updateBranch } from "@/lib/branches/service";

const branchIdSchema = z.string().uuid();

export async function PUT(
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

  const parsed = branchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos y horarios de la sucursal." }, { status: 400 });
  }

  try {
    await updateBranch(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo actualizar la sucursal.", error);
    const mutationError = getBranchMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}

export async function DELETE(
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

  const parsed = branchDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribí el nombre de la sucursal para confirmarla." }, { status: 400 });
  }

  try {
    await deleteBranch(id, parsed.data.confirmation);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("No se pudo eliminar la sucursal.", error);
    const mutationError = getBranchMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
