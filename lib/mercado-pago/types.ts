import { z } from "zod";

const snapshotMoneySchema = z.number().int().positive();

const bowlSnapshotLineSchema = z.object({
  type: z.literal("BOWL"),
  sourceId: z.string().uuid(),
  name: z.string().min(1),
  size: z.enum(["SMALL", "LARGE"]),
  ounces: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitPriceCents: snapshotMoneySchema,
  subtotalCents: snapshotMoneySchema,
}).strict().refine(
  (line) => Number.isSafeInteger(line.unitPriceCents * line.quantity) && line.subtotalCents === line.unitPriceCents * line.quantity,
  "El subtotal del bowl no coincide.",
);

const merchandiseSnapshotLineSchema = z.object({
  type: z.literal("MERCHANDISE"),
  sourceId: z.string().uuid(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: snapshotMoneySchema,
  subtotalCents: snapshotMoneySchema,
}).strict().refine(
  (line) => Number.isSafeInteger(line.unitPriceCents * line.quantity) && line.subtotalCents === line.unitPriceCents * line.quantity,
  "El subtotal del producto no coincide.",
);

export const checkoutOrderSnapshotSchema = z.object({
  version: z.literal(1),
  branch: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    whatsappNumber: z.string().min(1),
  }).strict(),
  items: z.array(z.discriminatedUnion("type", [bowlSnapshotLineSchema, merchandiseSnapshotLineSchema])).min(1),
}).strict();

export type CheckoutOrderSnapshot = z.infer<typeof checkoutOrderSnapshotSchema>;

export type MercadoPagoPreferenceRequest = {
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    currency_id: "ARS";
  }>;
  external_reference: string;
  back_urls: { success: string; pending: string; failure: string };
  auto_return: "approved";
  expires: true;
  expiration_date_from: string;
  expiration_date_to: string;
};

export type MercadoPagoPayment = {
  id: string;
  status: string;
  transactionAmount: number;
  currencyId: string;
  externalReference: string;
  liveMode: boolean;
  dateApproved: string | null;
};

export interface MercadoPagoGateway {
  createPreference(input: MercadoPagoPreferenceRequest, idempotencyKey: string): Promise<{
    id: string;
    initPoint: string;
  }>;
  getPayment(paymentId: string): Promise<MercadoPagoPayment>;
}
