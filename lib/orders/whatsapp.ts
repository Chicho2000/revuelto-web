import type { OrderPaymentMethod, OrderFulfillment } from "@/lib/orders/schema";
import { DELIVERY_ZONE_LABEL } from "./fulfillment";

export type PreparedOrderLine = {
  key: string;
  type: "BOWL" | "REVUELTO" | "MERCHANDISE";
  menuCategory?: "REVUELTO" | "REVUELTITO" | "SANGUCHITO" | "BEBIDA";
  sourceId: string;
  name: string;
  variant: string | null;
  size: "SMALL" | "LARGE" | null;
  ounces: number | null;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const paymentLabels: Record<OrderPaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
};

export function formatOrderMoney(cents: number) {
  return currencyFormatter.format(cents / 100);
}

export function normalizeWhatsAppNumber(value: string) {
  const digits = value.trim().replace(/^00/, "").replace(/\D/g, "");
  if (/^54\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `549${digits}`;
  return null;
}

export function buildOrderMessage(lines: readonly PreparedOrderLine[], totalCents: number, paymentMethod: OrderPaymentMethod, delivery?: { fulfillment: OrderFulfillment; branchName: string; deliveryWindow: string | null; deliveryFeeCents: number; subtotalCents: number }) {
  const food = lines.filter((line) => (line.type === "BOWL" || line.type === "REVUELTO") && line.menuCategory !== "BEBIDA");
  const drinks = lines.filter((line) => line.menuCategory === "BEBIDA");
  const merchandise = lines.filter((line) => line.type === "MERCHANDISE");
  const sections: string[] = ["¡Hola! 👋 Quiero hacer este pedido:"];
  if (delivery) {
    sections.push("", `Modalidad: ${delivery.fulfillment.mode === "DELIVERY" ? "Envío a domicilio" : "Retiro en el local"}`, `Sucursal: ${delivery.branchName}`);
    if (delivery.fulfillment.mode === "DELIVERY") {
      sections.push(`Dirección: ${delivery.fulfillment.address}`);
      if (delivery.fulfillment.details) sections.push(`Indicaciones: ${delivery.fulfillment.details}`);
      sections.push(`Zona: ${DELIVERY_ZONE_LABEL}`, `Entrega de hoy: ${delivery.deliveryWindow}`, "Solicito confirmación del envío y del horario de entrega.");
    }
  }

  if (food.length > 0) {
    sections.push("", "🍳 COMIDA");
    for (const line of food) {
      sections.push(`• ${line.quantity} × ${line.name}${line.variant ? ` — ${line.variant}` : ""} — ${formatOrderMoney(line.subtotalCents)}`);
    }
  }

  if (drinks.length > 0) {
    sections.push("", "🥤 BEBIDAS");
    for (const line of drinks) {
      sections.push(`• ${line.quantity} × ${line.name}${line.variant ? ` — ${line.variant}` : ""} — ${formatOrderMoney(line.subtotalCents)}`);
    }
  }

  if (merchandise.length > 0) {
    sections.push("", "🛍️ MERCH");
    for (const line of merchandise) {
      sections.push(`• ${line.quantity} × ${line.name} — ${formatOrderMoney(line.subtotalCents)}`);
    }
  }

  const paymentIcon = paymentMethod === "CASH" ? "💵" : "💳";
  if (delivery?.fulfillment.mode === "DELIVERY") sections.push("", `Subtotal de productos: ${formatOrderMoney(delivery.subtotalCents)}`, `Envío: ${formatOrderMoney(delivery.deliveryFeeCents)}`);
  sections.push(
    "",
    `💰 Total: ${formatOrderMoney(totalCents)}`,
    "",
    `${paymentIcon} Forma de pago: ${paymentLabels[paymentMethod]}`,
    "",
    "¡Gracias! 🙌",
  );
  return sections.join("\n");
}

export function buildConfirmedMercadoPagoMessage(
  lines: readonly PreparedOrderLine[],
  totalCents: number,
  publicCode: string,
) {
  const message = buildOrderMessage(lines, totalCents, "MERCADO_PAGO");
  return message.replace(
    "\n\n¡Gracias! 🙌",
    `\n✅ Pago confirmado\n\nCódigo: ${publicCode}\n\n¡Gracias! 🙌`,
  );
}

export function buildOrderWhatsAppUrls(number: string, message: string) {
  const normalized = normalizeWhatsAppNumber(number);
  if (!normalized) return null;

  const mobileParams = new URLSearchParams({
    phone: normalized,
    text: message,
  });

  const mobileFallbackUrl = new URL(`https://wa.me/${normalized}`);
  mobileFallbackUrl.searchParams.set("text", message);

  const desktopUrl = new URL("https://web.whatsapp.com/send");
  desktopUrl.searchParams.set("phone", normalized);
  desktopUrl.searchParams.set("text", message);

  return {
    mobileWhatsappUrl: `whatsapp://send?${mobileParams.toString()}`,
    mobileFallbackWhatsappUrl: mobileFallbackUrl.toString(),
    desktopWhatsappUrl: desktopUrl.toString(),
  };
}
