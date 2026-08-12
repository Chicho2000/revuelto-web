"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main className="status-section">
          <p>Error temporal</p>
          <h1>Ocurrió un error. Intentá nuevamente.</h1>
          <button type="button" onClick={reset}>Reintentar</button>
        </main>
      </body>
    </html>
  );
}
