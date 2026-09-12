CREATE TYPE "CheckoutPaymentMethod" AS ENUM ('MERCADO_PAGO');
CREATE TYPE "CheckoutPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "CheckoutOrder" (
    "id" UUID NOT NULL,
    "publicCode" TEXT NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "branchId" UUID,
    "paymentMethod" "CheckoutPaymentMethod" NOT NULL DEFAULT 'MERCADO_PAGO',
    "paymentStatus" "CheckoutPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "subtotalCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "itemsSnapshot" JSONB NOT NULL,
    "mercadoPagoIdempotencyKey" UUID NOT NULL,
    "mercadoPagoPreferenceId" TEXT,
    "mercadoPagoPaymentId" TEXT,
    "mercadoPagoStatus" TEXT,
    "mercadoPagoInitPoint" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CheckoutOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CheckoutOrder_subtotalCents_check" CHECK ("subtotalCents" > 0),
    CONSTRAINT "CheckoutOrder_totalCents_check" CHECK ("totalCents" > 0),
    CONSTRAINT "CheckoutOrder_totals_match_check" CHECK ("subtotalCents" = "totalCents"),
    CONSTRAINT "CheckoutOrder_currency_check" CHECK ("currency" = 'ARS')
);

CREATE UNIQUE INDEX "CheckoutOrder_publicCode_key" ON "CheckoutOrder"("publicCode");
CREATE UNIQUE INDEX "CheckoutOrder_clientRequestId_key" ON "CheckoutOrder"("clientRequestId");
CREATE UNIQUE INDEX "CheckoutOrder_mercadoPagoIdempotencyKey_key" ON "CheckoutOrder"("mercadoPagoIdempotencyKey");
CREATE UNIQUE INDEX "CheckoutOrder_mercadoPagoPreferenceId_key" ON "CheckoutOrder"("mercadoPagoPreferenceId");
CREATE UNIQUE INDEX "CheckoutOrder_mercadoPagoPaymentId_key" ON "CheckoutOrder"("mercadoPagoPaymentId");
CREATE INDEX "CheckoutOrder_paymentStatus_createdAt_idx" ON "CheckoutOrder"("paymentStatus", "createdAt");
CREATE INDEX "CheckoutOrder_expiresAt_idx" ON "CheckoutOrder"("expiresAt");
CREATE INDEX "CheckoutOrder_branchId_createdAt_idx" ON "CheckoutOrder"("branchId", "createdAt");

ALTER TABLE "CheckoutOrder"
ADD CONSTRAINT "CheckoutOrder_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CheckoutOrder" ENABLE ROW LEVEL SECURITY;
