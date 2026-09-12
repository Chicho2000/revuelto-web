"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function CheckoutRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button className="public-button" type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Consultando…" : "Actualizar estado"}
    </button>
  );
}
