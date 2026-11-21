export const DELIVERY_FEE_CENTS = 200_000;
export const REVUELTITO_COMBO_EXTRA_CENTS = 200_000;
export const DELIVERY_HOURS_LABEL = "Entregas de 12:00 a 15:00, hasta el cierre del local. Pedidos desde las 11:00 del mismo día.";
export const DELIVERY_ZONE_LABEL = "Entre Pellegrini, Oroño y el río";
export const COFFEE_DELIVERY_NOTICE = "El café es solo para consumir en el local o retirar. Para envío, elegí el combo con agua.";

export function getRevueltitoComboPrice(price: number | null) {
  return price === null ? null : Math.round(price * 100 + REVUELTITO_COMBO_EXTRA_CENTS) / 100;
}

export type DeliveryBusinessHour = { dayOfWeek: string; openingTime: string | null; closingTime: string | null; isClosed: boolean };
const weekdays: Record<string, string> = { Mon: "MONDAY", Tue: "TUESDAY", Wed: "WEDNESDAY", Thu: "THURSDAY", Fri: "FRIDAY", Sat: "SATURDAY", Sun: "SUNDAY" };
const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const minutes = (value: string | null) => value && /^\d{2}:\d{2}$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
const timeLabel = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export function getDeliveryAvailability(hours: readonly DeliveryBusinessHour[], now: Date) {
  const parts = Object.fromEntries(clock.formatToParts(now).map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const today = hours.find((hour) => hour.dayOfWeek === weekdays[parts.weekday]);
  const opens = minutes(today?.openingTime ?? null);
  const closes = minutes(today?.closingTime ?? null);
  if (!today || today.isClosed || opens === null || closes === null) return { available: false, preOrder: false, windowLabel: null, date };
  const start = Math.max(12 * 60, opens);
  const end = Math.min(15 * 60, closes);
  if (start >= end) return { available: false, preOrder: false, windowLabel: null, date };
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  return { available: current >= 11 * 60 && current < end, preOrder: current < start, windowLabel: `${timeLabel(start)} a ${timeLabel(end)}`, date };
}
