import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

process.env.SECURITY_HMAC_SECRET = "test-security-secret-that-is-long-enough";

test("normaliza email antes de hashear y no devuelve el valor original", async () => {
  const { hashSecurityValue, normalizeLoginEmail } = await import("../lib/security/hmac");
  const normalized = normalizeLoginEmail("  OWNER@REVUELTO.TEST ");

  assert.equal(normalized, "owner@revuelto.test");
  assert.equal(
    hashSecurityValue("login-email", normalized),
    hashSecurityValue("login-email", "owner@revuelto.test"),
  );
  assert.notEqual(hashSecurityValue("login-email", normalized), normalized);
});

test("solo bloquea al quinto fallo dentro de la ventana", async () => {
  const { evaluateLoginThrottle } = await import("../lib/security/login-rate-limit");
  const now = new Date("2026-08-01T12:00:00.000Z");
  const started = new Date("2026-08-01T11:50:00.000Z");

  assert.deepEqual(
    evaluateLoginThrottle({ failedAttempts: 3, windowStartedAt: started, blockedUntil: null }, now),
    { blocked: false },
  );
  assert.deepEqual(
    evaluateLoginThrottle({ failedAttempts: 5, windowStartedAt: started, blockedUntil: new Date("2026-08-01T12:15:00.000Z") }, now),
    { blocked: true },
  );
  assert.deepEqual(
    evaluateLoginThrottle({ failedAttempts: 5, windowStartedAt: new Date("2026-08-01T11:40:00.000Z"), blockedUntil: null }, now),
    { blocked: false },
  );
});

test("la actividad no puede extender la sesión más allá de una hora", async () => {
  const { getNextAdminSessionExpiration } = await import("../lib/security/admin-session");
  const now = new Date("2026-08-01T12:45:00.000Z");
  const absoluteExpiration = new Date("2026-08-01T13:00:00.000Z");

  assert.equal(
    getNextAdminSessionExpiration(now, absoluteExpiration).toISOString(),
    absoluteExpiration.toISOString(),
  );
});

test("mapea autenticación, autorización y dependencias al estado HTTP correcto", async () => {
  const { getOwnerAccessDenial } = await import("../lib/security/owner-access");
  assert.equal(getOwnerAccessDenial("unauthenticated").status, 401);
  assert.equal(getOwnerAccessDenial("forbidden").status, 403);
  assert.equal(getOwnerAccessDenial("session-expired").status, 403);
  assert.equal(getOwnerAccessDenial("configuration").status, 503);
});

test("el proxy diferencia handlers sensibles de páginas administrativas", async () => {
  const { isProtectedAdminHandlerPath } = await import("../lib/security/admin-handler-paths");
  for (const pathname of [
    "/admin/bowls/manage",
    "/admin/bowls/manage/id/status",
    "/admin/promotions/manage",
    "/admin/branches/manage/id",
    "/admin/content/manage",
    "/admin/content/gallery/manage/id",
    "/admin/images/upload-intent",
    "/admin/session/activity",
  ]) {
    assert.equal(isProtectedAdminHandlerPath(pathname), true, pathname);
  }
  assert.equal(isProtectedAdminHandlerPath("/admin/bowls"), false);
  assert.equal(isProtectedAdminHandlerPath("/admin/content/gallery"), false);
  assert.equal(isProtectedAdminHandlerPath("/admin/login"), false);
});

test("todos los handlers administrativos sensibles autorizan OWNER en servidor", () => {
  const routeFiles = [
    "app/admin/bowls/manage/route.ts",
    "app/admin/bowls/manage/[id]/route.ts",
    "app/admin/bowls/manage/[id]/status/route.ts",
    "app/admin/promotions/manage/route.ts",
    "app/admin/promotions/manage/[id]/route.ts",
    "app/admin/promotions/manage/[id]/status/route.ts",
    "app/admin/branches/manage/route.ts",
    "app/admin/branches/manage/[id]/route.ts",
    "app/admin/branches/manage/[id]/status/route.ts",
    "app/admin/content/manage/route.ts",
    "app/admin/content/gallery/manage/route.ts",
    "app/admin/content/gallery/manage/[id]/route.ts",
    "app/admin/content/gallery/manage/[id]/status/route.ts",
    "app/admin/images/upload-intent/route.ts",
    "app/admin/images/complete/route.ts",
    "app/admin/images/discard/route.ts",
    "app/admin/session/activity/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(path.resolve(routeFile), "utf8");
    assert.match(source, /await getOwnerRouteAuthorization\(\)/, routeFile);
  }
});

async function validImage(format: "jpeg" | "png" | "webp") {
  return sharp({
    create: { width: 120, height: 80, channels: 3, background: "#f0c000" },
  })[format]().toBuffer();
}

test("acepta JPEG, PNG y WebP conservando formato, bytes y dimensiones", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { validateAndProcessImage } = await import("../lib/images/image-processing");

  for (const expected of [
    { format: "jpeg" as const, extension: "jpg", contentType: "image/jpeg" },
    { format: "png" as const, extension: "png", contentType: "image/png" },
    { format: "webp" as const, extension: "webp", contentType: "image/webp" },
  ]) {
    const source = await validImage(expected.format);
    const result = await validateAndProcessImage(source, TemporaryImageTarget.BOWL);
    assert.equal(result.buffer.equals(source), true);
    assert.equal(result.format, expected.format);
    assert.equal(result.extension, expected.extension);
    assert.equal(result.contentType, expected.contentType);
    assert.equal(result.width, 120);
    assert.equal(result.height, 80);
  }
});

test("no redimensiona, rota, comprime, elimina metadata ni convierte JPEG", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { validateAndProcessImage } = await import("../lib/images/image-processing");
  const source = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "#f0c000" },
  })
    .jpeg({ quality: 90 })
    .withMetadata({ exif: { IFD0: { Copyright: "test" } } })
    .toBuffer();

  const result = await validateAndProcessImage(source, TemporaryImageTarget.BOWL);
  assert.equal(result.buffer.equals(source), true);
  assert.equal(result.format, "jpeg");
  assert.equal(result.width, 2000);
  assert.equal(result.height, 1000);
});

test("rechaza PDF renombrado, SVG y formatos no permitidos por contenido real", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { InvalidImageError, validateAndProcessImage } = await import("../lib/images/image-processing");
  for (const source of [
    Buffer.from("%PDF-1.7\nrenamed-as-photo.jpg"),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
  ]) {
    await assert.rejects(
      validateAndProcessImage(source, TemporaryImageTarget.BOWL),
      InvalidImageError,
    );
  }
});

test("un archivo mayor a 5 MB produce el error diferenciable para HTTP 413", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { ImageTooLargeError, validateAndProcessImage } = await import("../lib/images/image-processing");
  await assert.rejects(
    validateAndProcessImage(Buffer.alloc(5 * 1024 * 1024 + 1), TemporaryImageTarget.BRANCH),
    ImageTooLargeError,
  );
});

test("rechaza ancho, alto y área superiores a los límites", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { InvalidImageError, validateAndProcessImage } = await import("../lib/images/image-processing");
  const dimensions = [
    { width: 6001, height: 10 },
    { width: 10, height: 6001 },
    { width: 5000, height: 5000 },
  ];
  for (const { width, height } of dimensions) {
    const source = await sharp({
      create: { width, height, channels: 3, background: "#ffb300" },
    }).jpeg().toBuffer();
    await assert.rejects(
      validateAndProcessImage(source, TemporaryImageTarget.BOWL),
      InvalidImageError,
    );
  }
});

async function animatedImage(format: "gif" | "webp") {
  const first = Buffer.alloc(10 * 10 * 4, 255);
  const second = Buffer.alloc(10 * 10 * 4, 0);
  return sharp(Buffer.concat([first, second]), {
    raw: { width: 10, height: 20, pageHeight: 10, channels: 4 },
  })[format]({ loop: 0, delay: [100, 100] }).toBuffer();
}

test("rechaza GIF animado y WebP animado", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { InvalidImageError, validateAndProcessImage } = await import("../lib/images/image-processing");
  for (const format of ["gif", "webp"] as const) {
    await assert.rejects(
      validateAndProcessImage(await animatedImage(format), TemporaryImageTarget.GALLERY),
      InvalidImageError,
    );
  }
});

test("el rate limit de imágenes conserva 8 preparaciones por 10 minutos y usa Prisma", async () => {
  const { isUploadIntentRateLimited, MAX_UPLOAD_INTENTS_PER_WINDOW, UPLOAD_INTENT_WINDOW_MS } =
    await import("../lib/images/temporary-images");
  assert.equal(MAX_UPLOAD_INTENTS_PER_WINDOW, 8);
  assert.equal(UPLOAD_INTENT_WINDOW_MS, 10 * 60 * 1000);
  assert.equal(isUploadIntentRateLimited(7), false);
  assert.equal(isUploadIntentRateLimited(8), true);
  assert.match(readFileSync(path.resolve("lib/images/temporary-images.ts"), "utf8"), /temporaryImage\.count/);
});

test("cleanup distingue recientes, vencidos, confirmados, finales y rutas inseguras", async () => {
  const { TemporaryImageStatus } = await import("../generated/prisma/client");
  const { getTemporaryImageCleanupDisposition } = await import("../lib/images/temporary-images");
  const now = new Date("2026-08-08T12:00:00.000Z");
  const base = {
    ownerId: "owner-id",
    status: TemporaryImageStatus.READY,
    expiresAt: new Date("2026-08-08T11:59:59.000Z"),
    stagingPath: "staging/owner-id/image-id",
    tempPath: "temp/owner-id/image-id.png",
    finalPath: null,
  };

  assert.equal(getTemporaryImageCleanupDisposition(base, now), "delete");
  assert.equal(
    getTemporaryImageCleanupDisposition({ ...base, expiresAt: new Date("2026-08-08T12:00:01.000Z") }, now),
    "skip",
  );
  assert.equal(
    getTemporaryImageCleanupDisposition({ ...base, status: TemporaryImageStatus.CONFIRMED }, now),
    "skip",
  );
  assert.equal(
    getTemporaryImageCleanupDisposition({ ...base, finalPath: "gallery/entity/final.png" }, now),
    "confirm",
  );
  assert.equal(
    getTemporaryImageCleanupDisposition({ ...base, tempPath: "temp/other-owner/image.png" }, now),
    "unsafe",
  );
});

test("cleanup usa operaciones idempotentes y nunca elimina rutas finales", () => {
  const source = readFileSync(path.resolve("lib/images/temporary-images.ts"), "utf8");
  assert.match(source, /temporaryImage\.deleteMany/);
  assert.doesNotMatch(source, /MEDIA_STORAGE_BUCKET\)\.remove\(\[image\.finalPath\]/);
});

test("el cron exige Bearer con comparación segura", async () => {
  const { isValidCronAuthorization } = await import("../lib/security/cron");
  const secret = "cron-secret-long-enough";
  assert.equal(isValidCronAuthorization(`Bearer ${secret}`, secret), true);
  assert.equal(isValidCronAuthorization(null, secret), false);
  assert.equal(isValidCronAuthorization("Bearer incorrect", secret), false);
});

test("Sentry elimina identidad, request, mensajes, contexto, breadcrumbs y spans", async () => {
  const { sanitizeSentryEvent, sanitizeSentryTransaction } = await import("../sentry-sanitize");
  const error = sanitizeSentryEvent({
    type: undefined,
    message: "token secreto",
    user: { email: "owner@example.com", ip_address: "203.0.113.10" },
    request: { headers: { authorization: "Bearer secret", cookie: "secret" }, data: "password=x" },
    extra: { captcha: "secret" },
    contexts: { private: { serviceRole: "secret" } },
    breadcrumbs: [{ message: "secret" }],
    exception: { values: [{ type: "Error", value: "postgresql://secret" }] },
  });
  assert.equal(error.user, undefined);
  assert.equal(error.request, undefined);
  assert.equal(error.extra, undefined);
  assert.equal(error.contexts, undefined);
  assert.equal(error.message, undefined);
  assert.deepEqual(error.breadcrumbs, []);
  assert.equal(error.exception?.values?.[0]?.value, "Redacted exception message");

  const transaction = sanitizeSentryTransaction({
    type: "transaction",
    transaction: "/admin/private-id",
    request: { headers: { authorization: "secret" } },
    spans: [{ span_id: "1234567890abcdef", trace_id: "1234567890abcdef1234567890abcdef", start_timestamp: 1, timestamp: 2, data: {} }],
  });
  assert.equal(transaction.transaction, undefined);
  assert.deepEqual(transaction.spans, []);
  assert.equal(transaction.request, undefined);
});

test("los errores inesperados devuelven 500 genérico sin Prisma ni stack", async () => {
  const { unexpectedErrorResponse } = await import("../lib/observability/route-errors");
  const internal = Object.assign(new Error("Prisma SQL postgresql://secret"), {
    name: "PrismaClientKnownRequestError",
  });
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const response = unexpectedErrorResponse("test", internal);
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.equal(body.includes("Ocurrió un error"), true);
    assert.equal(body.includes("Prisma"), false);
    assert.equal(body.includes("postgresql"), false);
    assert.equal(body.includes("stack"), false);
  } finally {
    console.error = originalConsoleError;
  }
});
