"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PromotionStatusButton({
  promotionId,
  isActive,
}: {
  promotionId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleStatus() {
    const action = isActive ? "desactivar" : "activar";
    const consequence = isActive ? " Dejará de verse públicamente." : "";
    if (!window.confirm(`¿Querés ${action} esta promoción?${consequence}`)) return;

    setIsPending(true);
    setError(null);
    try {
      const response = await fetch(`/admin/promotions/manage/${promotionId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "No se pudo cambiar el estado.");
      router.push(`/admin/promotions?message=${isActive ? "deactivated" : "activated"}`);
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
