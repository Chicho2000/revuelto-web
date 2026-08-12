"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="status-section">
      <p className="eyebrow">Error temporal</p>
      <h2>Ocurrió un error. Intentá nuevamente.</h2>
      <button className="button button-dark" type="button" onClick={reset}>Reintentar</button>
    </main>
  );
}
