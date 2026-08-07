import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsAppUrl, DEFAULT_SITE_CONTENT, siteContentFormSchema } from "../lib/content/schema";
import { submitContentDraft } from "../lib/content/workflow";
import { isActiveOwner } from "../lib/security/authorization";

test("acepta una actualización válida de contenido general", () => {
  const result = siteContentFormSchema.safeParse({
    ...DEFAULT_SITE_CONTENT,
    heroTitle: "Comé rico después de entrenar",
    heroButtonText: "Ver carta",
    heroButtonUrl: "#carta",
  });
  assert.equal(result.success, true);
});

test("rechaza un heroTitle vacío", () => {
  assert.equal(siteContentFormSchema.safeParse({ ...DEFAULT_SITE_CONTENT, heroTitle: " " }).success, false);
});

test("WhatsApp desactivado no produce un enlace público", () => {
  assert.equal(buildWhatsAppUrl({ whatsappEnabled: false, whatsappNumber: "+54 9 11 1234 5678", whatsappDefaultMessage: "Hola" }), null);
});

test("un error de persistencia conserva todos los valores del borrador", async () => {
  const draft = { ...DEFAULT_SITE_CONTENT, heroTitle: "Valor sin perder" };
  const result = await submitContentDraft(draft, async () => { throw new Error("base no disponible"); });
  assert.strictEqual(result.draft, draft);
  assert.equal(result.draft.heroTitle, "Valor sin perder");
  assert.equal(result.error, "base no disponible");
});

test("la autorización administrativa exige OWNER activo", () => {
  assert.equal(isActiveOwner({ role: "OWNER", isActive: true }), true);
  assert.equal(isActiveOwner({ role: "OWNER", isActive: false }), false);
  assert.equal(isActiveOwner({ role: "EDITOR", isActive: true }), false);
});
