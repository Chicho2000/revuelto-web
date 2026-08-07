import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import { bowlStatusSchema, getBowlMutationError } from "@/lib/bowls/schema";
import { setBowlActive } from "@/lib/bowls/service";

const bowlIdSchema = z.string().uuid();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = bowlIdSchema.safeParse(id);
  const parsedBody = bowlStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsedId.success || !parsedBody.success) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  try {
    await setBowlActive(id, parsedBody.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mutationError = getBowlMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
