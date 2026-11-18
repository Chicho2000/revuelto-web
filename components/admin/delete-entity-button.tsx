"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type DeleteEntityButtonProps = {
  entityName: string;
  entityLabel: string;
  endpoint: string;
  redirectTo: string;
  isActive: boolean;
};

export function DeleteEntityButton({
  entityName,
  entityLabel,
  endpoint,
  redirectTo,
  isActive,
}: DeleteEntityButtonProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isExactConfirmation = confirmation === entityName;

  function cancel() {
    if (isPending) return;
    setConfirmation("");
    setError(null);
    setIsConfirming(false);
  }

  function remove() {
    if (!isExactConfirmation || isPending) return;
    if (!window.confirm(`¿Borrar definitivamente «${entityName}»? Esta acción no se puede deshacer.`)) return;

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation }),
        });
        const payload: unknown = await response.json().catch(() => null);
        const message =
          typeof payload === "object" && payload !== null && "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "No se pudo borrar. Intentá nuevamente.";

        if (!response.ok) {
          setError(message);
          return;
        }

        router.push(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}message=deleted`);
        router.refresh();
      } catch {
        setError("No se pudo conectar para borrar. Intentá nuevamente.");
      }
    });
  }

  if (isActive) return null;

  if (!isConfirming) {
    return (
      <button className="admin-delete-button" type="button" onClick={() => setIsConfirming(true)}>
        Borrar
      </button>
    );
  }

  return (
    <div className="admin-delete-confirmation" aria-live="polite">
      <p>
        Este borrado es definitivo y no se puede deshacer. Para confirmar el elemento de {entityLabel}, escribí exactamente:
      </p>
      <strong>{entityName}</strong>
      <label>
        Nombre de {entityLabel}
        <input
          autoComplete="off"
          disabled={isPending}
          onChange={(event) => setConfirmation(event.target.value)}
          value={confirmation}
        />
      </label>
      {error && <p className="form-message">{error}</p>}
      <div className="admin-delete-actions">
        <button
          className="admin-delete-button"
          disabled={!isExactConfirmation || isPending}
          onClick={remove}
          type="button"
        >
          {isPending ? "Borrando..." : "Borrar definitivamente"}
        </button>
        <button disabled={isPending} onClick={cancel} type="button">
          Cancelar
        </button>
      </div>
    </div>
  );
}
