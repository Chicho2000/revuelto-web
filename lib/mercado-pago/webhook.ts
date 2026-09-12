import { z } from "zod";

export const mercadoPagoNotificationSchema = z.object({
  type: z.literal("payment"),
  action: z.enum(["payment.created", "payment.updated"]),
  live_mode: z.boolean(),
  data: z.object({
    id: z.union([z.string().regex(/^\d{1,30}$/), z.number().int().nonnegative()]).transform(String),
  }).strict(),
}).passthrough();
