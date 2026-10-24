import { NextRequest, NextResponse } from "next/server";
import { createRevuelto } from "@/lib/revueltos/service";
import { getRevueltoMutationError, revueltoFormSchema } from "@/lib/revueltos/schema";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const parsed = revueltoFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.removeImage) {
    return NextResponse.json({ error: "Revisá los datos del Revuelto." }, { status: 400 });
  }
  try {
    const revuelto = await createRevuelto(authorization.access.adminUser.id, parsed.data);
    return NextResponse.json({ ok: true, revueltoId: revuelto.id }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse("revueltos.create", error, getRevueltoMutationError);
  }
}
