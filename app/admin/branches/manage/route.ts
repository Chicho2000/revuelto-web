import { NextRequest, NextResponse } from "next/server";
import { getOwnerAccess } from "@/lib/auth";
import { branchInputSchema, getBranchMutationError } from "@/lib/branches/schema";
import { createBranch } from "@/lib/branches/service";

export async function POST(request: NextRequest) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = branchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos y horarios de la sucursal." }, { status: 400 });
  }

  try {
    const branch = await createBranch(parsed.data);
    return NextResponse.json({ ok: true, branchId: branch.id }, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear la sucursal.", error);
    const mutationError = getBranchMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
