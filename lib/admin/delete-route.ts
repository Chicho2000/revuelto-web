import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deletionSchema, getDeletionError, type DeletionTarget } from "./deletion";
import { deleteCatalogEntity } from "./deletion-service";
import { mutationErrorResponse } from "@/lib/observability/route-errors";

// Called only after each Route Handler has authorized an active OWNER.
export async function confirmedDeleteResponse(request: NextRequest, id: string, target: DeletionTarget) {
  const parsed = deletionSchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Revisá el elemento y escribí su nombre para confirmar." }, { status: 400 });
  }
  try {
    await deleteCatalogEntity(target, id, parsed.data.confirmation);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse("admin.delete", error, getDeletionError);
  }
}
