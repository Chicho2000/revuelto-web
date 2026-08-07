import "server-only";
import { getTurnstileEnvironment } from "@/lib/env";

const TURNSTILE_ACTION = "admin-login";

export function getTurnstileSiteKey() {
  return getTurnstileEnvironment()?.TURNSTILE_SITE_KEY ?? null;
}

export async function verifyTurnstile(token: string | undefined, remoteIp: string) {
  const environment = getTurnstileEnvironment();
  if (!environment) return { ok: false, configurationError: true } as const;
  if (!token) return { ok: false, configurationError: false } as const;

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: environment.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: remoteIp,
      }),
      cache: "no-store",
    });
    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };

    return {
      ok:
        response.ok &&
        result.success === true &&
        result.action === TURNSTILE_ACTION &&
        result.hostname === environment.TURNSTILE_EXPECTED_HOSTNAME,
      configurationError: false,
    } as const;
  } catch {
    return { ok: false, configurationError: true } as const;
  }
}
