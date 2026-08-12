import "server-only";
import { NextResponse } from "next/server";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";

type PublicMutationError = { status: number; message: string };

export function mutationErrorResponse(
  area: string,
  error: unknown,
  getPublicError: (error: unknown) => PublicMutationError,
) {
  const publicError = getPublicError(error);
  if (publicError.status === 500) reportUnexpectedServerError(area, error);
  return NextResponse.json({ error: publicError.message }, { status: publicError.status });
}

export function unexpectedErrorResponse(area: string, error: unknown) {
  reportUnexpectedServerError(area, error);
  return NextResponse.json({ error: "Ocurrió un error. Intentá nuevamente." }, { status: 500 });
}
