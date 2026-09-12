import "server-only";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import type { MercadoPagoGateway, MercadoPagoPreferenceRequest } from "@/lib/mercado-pago/types";

export function isAllowedMercadoPagoCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname === "mercadopago.com" ||
      url.hostname.endsWith(".mercadopago.com") ||
      url.hostname === "mercadopago.com.ar" ||
      url.hostname.endsWith(".mercadopago.com.ar")
    );
  } catch {
    return false;
  }
}

export function createMercadoPagoGateway(accessToken: string): MercadoPagoGateway {
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8_000 } });
  const preference = new Preference(client);
  const payment = new Payment(client);

  return {
    async createPreference(input: MercadoPagoPreferenceRequest, idempotencyKey: string) {
      const response = await preference.create({ body: input, requestOptions: { idempotencyKey } });
      if (!response.id || !response.init_point || !isAllowedMercadoPagoCheckoutUrl(response.init_point)) {
        throw new Error("InvalidMercadoPagoPreferenceResponse");
      }
      return { id: response.id, initPoint: response.init_point };
    },
    async getPayment(paymentId: string) {
      const response = await payment.get({ id: paymentId });
      if (
        response.id === undefined ||
        typeof response.status !== "string" ||
        typeof response.transaction_amount !== "number" ||
        typeof response.currency_id !== "string" ||
        typeof response.external_reference !== "string" ||
        typeof response.live_mode !== "boolean"
      ) {
        throw new Error("InvalidMercadoPagoPaymentResponse");
      }
      return {
        id: String(response.id),
        status: response.status,
        transactionAmount: response.transaction_amount,
        currencyId: response.currency_id,
        externalReference: response.external_reference,
        liveMode: response.live_mode,
        dateApproved: response.date_approved ?? null,
      };
    },
  };
}
