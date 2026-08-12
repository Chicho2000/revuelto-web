import type { ErrorEvent, Event, TransactionEvent } from "@sentry/core";

function sanitizeEvent<T extends Event>(event: T): T {
  const sanitized = { ...event } as T;

  // Keep only stack locations and controlled operational tags. Identity,
  // request data, headers, cookies, bodies, URLs, arbitrary contexts and
  // breadcrumbs are removed before transport in every runtime.
  delete sanitized.user;
  delete sanitized.request;
  delete sanitized.extra;
  delete sanitized.contexts;
  delete sanitized.server_name;
  delete sanitized.modules;
  delete sanitized.transaction;
  delete sanitized.message;
  delete sanitized.logentry;
  sanitized.breadcrumbs = [];
  sanitized.tags = Object.fromEntries(
    Object.entries(sanitized.tags ?? {}).filter(([key]) => key === "area" || key === "runtime"),
  );

  if (sanitized.exception?.values) {
    sanitized.exception = {
      ...sanitized.exception,
      values: sanitized.exception.values.map((exception) => ({
        ...exception,
        value: "Redacted exception message",
      })),
    };
  }

  if ("spans" in sanitized) sanitized.spans = [];
  return sanitized;
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  return sanitizeEvent(event);
}

export function sanitizeSentryTransaction(event: TransactionEvent): TransactionEvent {
  return sanitizeEvent(event);
}
