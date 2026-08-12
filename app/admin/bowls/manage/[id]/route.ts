import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bowlDeleteSchema, bowlInputSchema, getBowlMutationError } from "@/lib/bowls/schema";
import { deleteBowl, updateBowl } from "@/lib/bowls/service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";
import { getOwnerRouteAuthorization } from "@/lib/security/owner-route";

const bowlIdSchema = z.string().uuid();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;
  const { access } = authorization;

  const { id } = await params;
  if (!bowlIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Bowl inválido." }, { status: 400 });
  }

  const parsed = bowlInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos del bowl.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    await updateBowl(access.adminUser.id, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("bowls.update", error, getBowlMutationError);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await getOwnerRouteAuthorization();
  if (authorization.response) return authorization.response;

  const { id } = await params;
  if (!bowlIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Bowl inválido." }, { status: 400 });
  }

  const parsed = bowlDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribí el nombre del bowl para confirmarlo." }, { status: 400 });
  }

  try {
    await deleteBowl(id, parsed.data.confirmation);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("bowls.delete", error, getBowlMutationError);
  }
}
