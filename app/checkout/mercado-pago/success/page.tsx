import type { Metadata } from "next";
import { MercadoPagoReturnPage } from "@/app/checkout/mercado-pago/return-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Estado del pago | Revuelto", robots: { index: false, follow: false } };

export default function MercadoPagoSuccessPage({ searchParams }: { searchParams: Promise<{ code?: string; payment_id?: string }> }) {
  return <MercadoPagoReturnPage kind="success" searchParams={searchParams} />;
}
