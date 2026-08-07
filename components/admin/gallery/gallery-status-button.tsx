"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GalleryStatusButton({ galleryItemId, isActive }: { galleryItemId: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleStatus() {
    if (!window.confirm(`¿Querés ${isActive ? "desactivar" : "activar"} este elemento?`)) return;
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch(`/admin/content/gallery/manage/${galleryItemId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "No se pudo cambiar el estado.");
      router.push(`/admin/content/gallery?message=${isActive ? "deactivated" : "activated"}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar el estado.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="admin-inline-action">
      <button type="button" disabled={isPending} onClick={toggleStatus}>
        {isPending ? "Guardando…" : isActive ? "Desactivar" : "Activar"}
      </button>
      {error && <small>{error}</small>}
    </div>
  );
}
