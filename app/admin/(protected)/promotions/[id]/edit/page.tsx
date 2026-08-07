import { notFound } from "next/navigation";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { PromotionForm } from "@/components/admin/promotions/promotion-form";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  const { id } = await params;
  const promotion = await getPrisma().promotion.findUnique({ where: { id } });
  if (!promotion) notFound();

  return (
    <section className="admin-panel admin-promotion-panel">
      <p className="eyebrow">Promociones</p>
      <h1>Editar promoción</h1>
      <PromotionForm
        mode="edit"
        promotionId={promotion.id}
        initialImageUrl={promotion.imageUrl}
        initialValues={{
          title: promotion.title,
          body: promotion.description,
          weeklyDays: promotion.weeklyDays ?? [],
          dailyStartTime: promotion.dailyStartTime ?? "",
          dailyEndTime: promotion.dailyEndTime ?? "",
          isActive: promotion.isActive,
          temporaryImageId: null,
          removeImage: false,
        }}
      />
    </section>
  );
}
