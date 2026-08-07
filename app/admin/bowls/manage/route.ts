import { NextRequest, NextResponse } from "next/server";
import { getOwnerAccess } from "@/lib/auth";
import { bowlInputSchema, getBowlMutationError } from "@/lib/bowls/schema";
import { createBowl } from "@/lib/bowls/service";

export async function POST(request: NextRequest) {
  const access = await getOwnerAccess();
  if (access.status !== "owner") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

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
    console.error("No se pudo crear el bowl.", error);
    const mutationError = getBowlMutationError(error);
    return NextResponse.json({ error: mutationError.message }, { status: mutationError.status });
  }
}
