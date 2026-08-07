import assert from "node:assert/strict";
import test from "node:test";
import {
  branchInputSchema,
  branchDeleteSchema,
  branchStatusSchema,
  branchValues,
  createClosedBranchSchedules,
  getBranchMutationError,
  isBranchPublic,
  scheduleValues,
} from "../lib/branches/schema";
import { isActiveOwner } from "../lib/security/authorization";

const openSchedules = createClosedBranchSchedules().map((schedule) => ({
  ...schedule,
  isOpen: true,
  openTime: "08:00",
  closeTime: "20:00",
}));

const validBranch = {
  name: "Revuelto Centro",
  address: "Av. Siempre Viva 123",
  city: "Buenos Aires",
  phone: "11 5555 5555",
  isActive: true,
  schedules: openSchedules,
};

test("acepta una creación válida con siete horarios", () => {
  const parsed = branchInputSchema.parse(validBranch);
  assert.equal(parsed.schedules.length, 7);
});

test("rechaza una sucursal si falta un día", () => {
  const result = branchInputSchema.safeParse({ ...validBranch, schedules: openSchedules.slice(0, 6) });
  assert.equal(result.success, false);
});

test("rechaza un día duplicado", () => {
  const schedules = openSchedules.map((schedule) => ({ ...schedule }));
  schedules[6].dayOfWeek = "MONDAY";
  assert.equal(branchInputSchema.safeParse({ ...validBranch, schedules }).success, false);
});

test("rechaza apertura o cierre faltante en un día abierto", () => {
  const schedules = openSchedules.map((schedule) => ({ ...schedule }));
  schedules[0].openTime = "";
  schedules[1].closeTime = "";
  assert.equal(branchInputSchema.safeParse({ ...validBranch, schedules }).success, false);
});

test("rechaza un cierre que no sea posterior a la apertura", () => {
  const schedules = openSchedules.map((schedule) => ({ ...schedule }));
  schedules[0].openTime = "20:00";
  schedules[0].closeTime = "08:00";
  assert.equal(branchInputSchema.safeParse({ ...validBranch, schedules }).success, false);
});

test("acepta un día cerrado y persiste sus horas como nulas", () => {
  const schedule = createClosedBranchSchedules()[0];
  const parsed = branchInputSchema.parse({
    ...validBranch,
    schedules: [schedule, ...openSchedules.slice(1)],
  });
  assert.deepEqual(scheduleValues(parsed.schedules[0]), {
    dayOfWeek: "MONDAY",
    isClosed: true,
    openingTime: null,
    closingTime: null,
  });
});

test("valida la edición de los datos generales", () => {
  const parsed = branchInputSchema.parse({
    ...validBranch,
    name: "Revuelto Norte",
    address: "Calle Nueva 456",
    city: "Vicente López",
    phone: "",
  });
  assert.deepEqual(branchValues(parsed), {
    name: "Revuelto Norte",
    address: "Calle Nueva 456",
    city: "Vicente López",
    phone: "",
    isActive: true,
  });
});

test("valida la edición de horarios", () => {
  const schedules = openSchedules.map((schedule) => ({ ...schedule }));
  schedules[4].openTime = "10:30";
  schedules[4].closeTime = "22:00";
  const parsed = branchInputSchema.parse({ ...validBranch, schedules });
  assert.equal(parsed.schedules[4].openTime, "10:30");
  assert.equal(parsed.schedules[4].closeTime, "22:00");
});

test("acepta activación y desactivación explícitas", () => {
  assert.equal(branchStatusSchema.parse({ isActive: true }).isActive, true);
  assert.equal(branchStatusSchema.parse({ isActive: false }).isActive, false);
});

test("requiere una confirmación no vacía para borrar una sucursal", () => {
  assert.equal(branchDeleteSchema.safeParse({ confirmation: "Revuelto Centro" }).success, true);
  assert.equal(branchDeleteSchema.safeParse({ confirmation: "" }).success, false);
});

test("traduce una confirmación de borrado incorrecta", () => {
  assert.deepEqual(getBranchMutationError({ code: "CONFIRMATION_MISMATCH" }), {
    status: 400,
    message: "Escribí exactamente el nombre de la sucursal para confirmarla.",
  });
});

test("deniega acceso a un usuario que no sea OWNER activo", () => {
  assert.equal(isActiveOwner({ role: "OWNER", isActive: true }), true);
  assert.equal(isActiveOwner({ role: "USER", isActive: true }), false);
  assert.equal(isActiveOwner({ role: "OWNER", isActive: false }), false);
});

test("una sucursal inactiva no es visible públicamente", () => {
  assert.equal(isBranchPublic({ isActive: true }), true);
  assert.equal(isBranchPublic({ isActive: false }), false);
});
