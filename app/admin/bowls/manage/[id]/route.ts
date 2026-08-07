import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerAccess } from "@/lib/auth";
import { bowlDeleteSchema, bowlInputSchema, getBowlMutationError } from "@/lib/bowls/schema";
import { deleteBowl, updateBowl } from "@/lib/bowls/service";

const bowlIdSchema = z.string().uuid();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

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
    console.error("No se pudo actualizar el bowl.", error);
    const mutationError = getBowlMutationError(error);
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
    console.error("No se pudo eliminar el bowl.", error);
    const mutationError = getBowlMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
