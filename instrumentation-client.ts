import * as Sentry from "@sentry/nextjs";
import { sanitizeSentryEvent, sanitizeSentryTransaction } from "./sentry-sanitize";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeBreadcrumb: () => null,
  beforeSend: sanitizeSentryEvent,
  beforeSendTransaction: sanitizeSentryTransaction,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
