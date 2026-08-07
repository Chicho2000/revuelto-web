"use client";

import { useEffect } from "react";

export function SessionExpired() {
  useEffect(() => {
    void fetch("/admin/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
      window.location.replace("/admin/login?message=session-expired");
    });
  }, []);

  return <main className="login-page"><p className="form-message">Cerrando sesión…</p></main>;
}
