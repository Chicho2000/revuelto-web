import "server-only";
import * as Sentry from "@sentry/nextjs";

export function reportUnexpectedServerError(area: string, error: unknown) {
  // Keep platform logs useful without putting request bodies, credentials, or
  // provider errors in plain text. Sentry receives the stack after its global
  // scrubbing hook removes request, user, breadcrumb, and exception details.
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error("[server-error]", { area, errorName });

  Sentry.withScope((scope) => {
    scope.setTag("area", area);
    scope.setTag("runtime", "server");
    Sentry.captureException(error);
  });
}
