"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function logout() {
    setIsPending(true);
    try {
      await fetch("/admin/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      router.replace("/admin/login?message=signed-out");
      router.refresh();
    }
  }

  return (
    <button type="button" className="admin-logout" onClick={logout} disabled={isPending}>
      {isPending ? "Saliendo…" : "Salir"}
    </button>
  );
}
