import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { PromotionForm } from "@/components/admin/promotions/promotion-form";
import { requireOwner } from "@/lib/auth";

export default async function NewPromotionPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  return (
    <section className="admin-panel admin-promotion-panel">
      <p className="eyebrow">Promociones</p>
      <h1>Nueva promoción</h1>
      <PromotionForm mode="create" />
    </section>
  );
}
