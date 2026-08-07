"use client";

import { useState } from "react";

export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setIsPending(true);
    try {
      await fetch("/admin/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      window.location.assign("/admin/login?message=signed-out");
    }
  }

  return (
    <button type="button" className="admin-logout" onClick={logout} disabled={isPending}>
      {isPending ? "Saliendo…" : "Salir"}
    </button>
  );
}
