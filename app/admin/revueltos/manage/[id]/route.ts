import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateRevuelto } from "@/lib/revueltos/service";
import { getRevueltoMutationError, revueltoFormSchema } from "@/lib/revueltos/schema";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const revueltoIdSchema = z.string().uuid();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!revueltoIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Revuelto inválido." }, { status: 400 });
  }
  const parsed = revueltoFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del Revuelto." }, { status: 400 });
  try {
    await updateRevuelto(authorization.access.adminUser.id, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("revueltos.update", error, getRevueltoMutationError);
  }
}
