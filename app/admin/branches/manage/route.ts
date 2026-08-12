import { NextRequest, NextResponse } from "next/server";
import { branchInputSchema, getBranchMutationError } from "@/lib/branches/schema";
import { createBranch } from "@/lib/branches/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;

  const parsed = branchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos y horarios de la sucursal." }, { status: 400 });
  }

  try {
    const branch = await createBranch(parsed.data);
    return NextResponse.json({ ok: true, branchId: branch.id }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse("branches.create", error, getBranchMutationError);
  }
}
