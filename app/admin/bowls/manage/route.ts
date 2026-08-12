import { NextRequest, NextResponse } from "next/server";
import { bowlInputSchema, getBowlMutationError } from "@/lib/bowls/schema";
import { createBowl } from "@/lib/bowls/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

export async function POST(request: NextRequest) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;

  const parsed = bowlInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos del bowl.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const bowl = await createBowl(access.adminUser.id, parsed.data);
    return NextResponse.json({ ok: true, bowlId: bowl.id }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse("bowls.create", error, getBowlMutationError);
  }
}
