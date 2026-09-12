import Link from "next/link";
import { CheckoutRefreshButton } from "@/components/public/order/checkout-refresh-button";
import { CheckoutWhatsAppActions } from "@/components/public/order/checkout-whatsapp-actions";
import { getPublicCheckoutView } from "@/lib/mercado-pago/checkout";
import { formatOrderMoney } from "@/lib/orders/whatsapp";

type ReturnKind = "success" | "pending" | "failure";

function statusCopy(status: string, kind: ReturnKind) {
  switch (status) {
    case "APPROVED": return { kicker: "Pago verificado", title: "Pago confirmado", description: "Mercado Pago confirmó el pago. Ya podés continuar el pedido por WhatsApp." };
    case "REJECTED": return { kicker: "Pago no aprobado", title: "No se pudo completar el pago", description: "Podés volver al carrito e iniciar un nuevo intento." };
    case "CANCELLED": return { kicker: "Pago cancelado", title: "El pago fue cancelado", description: "Tu carrito sigue guardado para que puedas intentarlo nuevamente." };
    case "REFUNDED": return { kicker: "Pago devuelto", title: "El pago fue devuelto", description: "No continúes este pedido como abonado." };
    case "EXPIRED": return { kicker: "Checkout vencido", title: "Este intento ya venció", description: "Volvé al carrito para iniciar una nueva operación con precios vigentes." };
    default:
      return kind === "failure"
        ? { kicker: "Pago no confirmado", title: "El pago no fue aprobado", description: "Estamos verificando el estado real. Tu carrito todavía se conserva." }
        : { kicker: "Verificación en curso", title: "Estamos confirmando tu pago", description: "El webhook puede tardar unos segundos. Actualizá el estado antes de continuar." };
  }
}

export async function MercadoPagoReturnPage({
  kind,
  searchParams,
}: {
  kind: ReturnKind;
  searchParams: Promise<{ code?: string; payment_id?: string }>;
}) {
  const params = await searchParams;
  const checkout = await getPublicCheckoutView(params.code ?? "", params.payment_id);

  if (!checkout) {
    return (
      <main className="checkout-status-page">
        <section>
          <p className="public-kicker">Operación no disponible</p>
          <h1>No pudimos encontrar este checkout</h1>
          <p>Volvé a Revuelto y revisá tu carrito.</p>
          <Link className="public-button public-button-dark" href="/">Volver a Revuelto</Link>
        </section>
      </main>
    );
  }

  const copy = statusCopy(checkout.paymentStatus, kind);
  return (
    <main className="checkout-status-page">
      <section>
        <p className="public-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <p>Sucursal: <strong>{checkout.branchName}</strong></p>
        <p>Código: <strong>{checkout.publicCode}</strong></p>
        <ul>
          {checkout.lines.map((line) => (
            <li key={line.key}>
              <span>{line.quantity} × {line.name}{line.variant ? ` — ${line.variant}` : ""}</span>
              <strong>{formatOrderMoney(line.subtotalCents)}</strong>
            </li>
          ))}
        </ul>
        <div className="checkout-status-total"><span>Total</span><strong>{formatOrderMoney(checkout.totalCents)}</strong></div>
        {checkout.paymentStatus === "APPROVED" && checkout.whatsapp && <CheckoutWhatsAppActions {...checkout.whatsapp} />}
        {checkout.paymentStatus === "PENDING" && <CheckoutRefreshButton />}
        <Link className="checkout-back-link" href="/">Volver a Revuelto</Link>
      </section>
    </main>
  );
}
