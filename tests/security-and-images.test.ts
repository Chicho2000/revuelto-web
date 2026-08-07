import assert from "node:assert/strict";
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

test("procesa JPEG real como WebP para bowl sin ampliar", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { validateAndProcessImage } = await import("../lib/images/image-processing");
  const source = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#f0c000" } })
    .jpeg({ quality: 90 })
    .withMetadata({ exif: { IFD0: { Copyright: "test" } } })
    .toBuffer();

  const result = await validateAndProcessImage(source, TemporaryImageTarget.BOWL);
  const metadata = await sharp(result.buffer).metadata();

  assert.equal(metadata.format, "webp");
  assert.equal(result.width, 1600);
  assert.equal(result.height, 800);
  assert.equal(metadata.exif, undefined);
});

test("rechaza SVG aunque Sharp pueda reconocerlo", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { InvalidImageError, validateAndProcessImage } = await import("../lib/images/image-processing");
  await assert.rejects(
    validateAndProcessImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'), TemporaryImageTarget.BOWL),
    InvalidImageError,
  );
});

test("rechaza un bowl que supera 5 MB antes de decodificar", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { InvalidImageError, validateAndProcessImage } = await import("../lib/images/image-processing");
  await assert.rejects(
    validateAndProcessImage(Buffer.alloc(5 * 1024 * 1024 + 1), TemporaryImageTarget.BOWL),
    InvalidImageError,
  );
});

test("rechaza un bowl con más de 6000 píxeles de ancho", async () => {
  const { TemporaryImageTarget } = await import("../generated/prisma/client");
  const { InvalidImageError, validateAndProcessImage } = await import("../lib/images/image-processing");
  const source = await sharp({
    create: { width: 6001, height: 10, channels: 3, background: "#ffb300" },
  }).jpeg().toBuffer();
  await assert.rejects(
    validateAndProcessImage(source, TemporaryImageTarget.BOWL),
    InvalidImageError,
  );
});
