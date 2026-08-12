import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCronEnvironment } from "@/lib/env";
import { cleanupExpiredTemporaryImages } from "@/lib/images/temporary-images";
import { unexpectedErrorResponse } from "@/lib/observability/route-errors";
import { isValidCronAuthorization } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const environment = getCronEnvironment();
  if (!environment) {
    return NextResponse.json(
      { error: "El servicio no está disponible temporalmente." },
      { status: 503 },
    );
  }

  if (!isValidCronAuthorization(request.headers.get("authorization"), environment.CRON_SECRET)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    return NextResponse.json({
      ok: true,
      cleanup: await cleanupExpiredTemporaryImages(),
    });
  } catch (error) {
    return unexpectedErrorResponse("temporary-images.cleanup", error);
  }
}
