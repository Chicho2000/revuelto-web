"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function LoginForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const captchaElement = useRef<HTMLDivElement>(null);
  const captchaWidget = useRef<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey || !captchaElement.current) return;

    const render = () => {
      if (!window.turnstile || !captchaElement.current || captchaWidget.current) return;
      captchaWidget.current = window.turnstile.render(captchaElement.current, {
        sitekey: turnstileSiteKey,
        action: "admin-login",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(null),
        "error-callback": () => setTurnstileToken(null),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="admin-login"]');
    if (existing) {
      existing.addEventListener("load", render);
      render();
      return () => existing.removeEventListener("load", render);
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "admin-login";
    script.addEventListener("load", render);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", render);
  }, [turnstileSiteKey]);

  function resetTurnstile() {
    setTurnstileToken(null);
    if (captchaWidget.current && window.turnstile) {
      window.turnstile.reset(captchaWidget.current);
    }
  }

  function destination() {
    const next = searchParams.get("next");
    return next && next.startsWith("/") && !next.startsWith("//") && next !== "/admin/login"
      ? next
      : "/admin";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email")),
          password: String(formData.get("password")),
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        resetTurnstile();
        setMessage(result?.error ?? "El inicio de sesión no está disponible temporalmente.");
        return;
      }

      router.replace(destination());
      router.refresh();
    } catch {
      resetTurnstile();
      setMessage("El inicio de sesión no está disponible temporalmente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const stateMessage =
    searchParams.get("message") === "signed-out"
      ? "La sesión se cerró correctamente."
      : searchParams.get("message") === "session-expired"
        ? "La sesión expiró por inactividad."
        : null;

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <div>
        {turnstileSiteKey ? (
          <div ref={captchaElement} />
        ) : (
          <p className="form-message">La verificación adicional no está configurada.</p>
        )}
      </div>
      {stateMessage && <p className="form-message">{stateMessage}</p>}
      {message && <p className="form-message">{message}</p>}
      <button type="submit" disabled={isSubmitting || !turnstileToken}>
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
