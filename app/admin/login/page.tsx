import { LoginForm } from "./login-form";
import Image from "next/image";
import { Suspense } from "react";
import { getSupabaseEnvironment } from "@/lib/env";
import { getTurnstileSiteKey } from "@/lib/security/turnstile";

export default function AdminLoginPage() {
  const isConfigured = Boolean(getSupabaseEnvironment());

  return (
    <main className="login-page">
      <section className="login-card">
        <Image
          src="/brand/logos/logo-horizontal.svg"
          alt="Revuelto"
          className="login-logo"
          width={560}
          height={210}
        />
        <p className="eyebrow">Panel privado</p>
        <h1>Hola, equipo.</h1>
        <p>Ingresá con una de las cuentas creadas manualmente en Supabase Auth.</p>
        {isConfigured ? (
          <Suspense fallback={<p>Preparando acceso…</p>}>
            <LoginForm turnstileSiteKey={getTurnstileSiteKey()} />
          </Suspense>
        ) : (
          <p className="form-message">
            Falta configurar NEXT_PUBLIC_SUPABASE_URL y
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
          </p>
        )}
      </section>
    </main>
  );
}
