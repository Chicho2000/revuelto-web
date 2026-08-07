"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BowlStatusButton({ bowlId, isActive }: { bowlId: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleStatus() {
    if (isActive && !window.confirm("¿Querés desactivar este bowl? Dejará de verse en la carta.")) {
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      const response = await fetch(`/admin/bowls/manage/${bowlId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "No se pudo cambiar el estado.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar el estado.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="admin-inline-action">
      <button type="button" onClick={toggleStatus} disabled={isPending}>
        {isPending ? "Guardando…" : isActive ? "Desactivar" : "Activar"}
      </button>
      {error && <small>{error}</small>}
    </div>
  );
}
