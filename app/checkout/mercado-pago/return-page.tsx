import Link from "next/link";
import { MercadoPagoError, MPNotFoundError } from "mercadopago";
import { CheckoutRefreshButton } from "@/components/public/order/checkout-refresh-button";
import { CheckoutWhatsAppActions } from "@/components/public/order/checkout-whatsapp-actions";
import {
  getPublicCheckoutView,
  MercadoPagoCheckoutError,
} from "@/lib/mercado-pago/checkout";
import { formatOrderMoney } from "@/lib/orders/whatsapp";

type ReturnKind = "success" | "pending" | "failure";
const SAFE_LOG_VALUE = /^[A-Za-z0-9._:-]{1,100}$/;

type ReturnLogDetails = {
  paymentId?: string;
  providerStatus?: number;
  errorCode?: string;
  errorName?: string;
};

function safeLogValue(value: unknown) {
  return typeof value === "string" && SAFE_LOG_VALUE.test(value) ? value : undefined;
}

function sanitizedErrorDetails(error: unknown): ReturnLogDetails {
  const errorName = safeLogValue(error instanceof Error ? error.name : "UnknownError") ?? "UnknownError";
  if (error instanceof MercadoPagoCheckoutError) {
    return { errorName, errorCode: safeLogValue(error.code) };
  }
  if (error instanceof MercadoPagoError) {
    return {
      errorName,
      ...(error.status >= 100 && error.status <= 599 ? { providerStatus: error.status } : {}),
    };
  }
  return { errorName };
}

function logReturnStage(stage: string, details: ReturnLogDetails = {}) {
  console.info("[mercado-pago-return]", { stage, ...details });
}

function logReturnError(stage: string, details: ReturnLogDetails = {}) {
  console.error("[mercado-pago-return]", { stage, ...details });
}

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
  const checkout = await getPublicCheckoutView(params.code ?? "", params.payment_id, (event) => {
    const details = {
      ...(event.paymentId ? { paymentId: event.paymentId } : {}),
      ...(event.error !== undefined ? sanitizedErrorDetails(event.error) : {}),
    };
    if (event.error !== undefined) {
      logReturnError(event.stage, details);
    } else {
      logReturnStage(event.stage, details);
    }

    if (
      event.stage === "MP_RETURN_ORDER_LOOKUP_FAILED" ||
      event.stage === "MP_RETURN_ORDER_RELOAD_FAILED"
    ) {
      logReturnError("MP_RETURN_REPOSITORY_ERROR", details);
      return;
    }
    if (event.stage !== "MP_RETURN_RECONCILE_FAILED") return;
    if (event.error instanceof MercadoPagoCheckoutError && event.error.code === "NOT_CONFIGURED") {
      logReturnError("MP_RETURN_CONFIG_INVALID", details);
    } else if (event.error instanceof MPNotFoundError) {
      logReturnError("MP_RETURN_PAYMENT_NOT_FOUND", details);
    } else if (event.failureKind === "PROVIDER" || event.error instanceof MercadoPagoError) {
      logReturnError("MP_RETURN_PROVIDER_ERROR", details);
    } else if (event.failureKind === "REPOSITORY") {
      logReturnError("MP_RETURN_REPOSITORY_ERROR", details);
    } else {
      logReturnError("MP_RETURN_UNEXPECTED_ERROR", details);
    }
  });

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
