import { notFound } from "next/navigation";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { MerchandiseItemForm } from "@/components/admin/merchandise/merchandise-item-form";
import { requireOwner } from "@/lib/auth";
import { getPublicMerchandiseImageUrl } from "@/lib/merchandise/public-image";
import { getPrisma } from "@/lib/prisma";

export default async function EditMerchandiseItemPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const { id } = await params;
  const item = await getPrisma().merchandiseItem.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <section className="admin-panel admin-merchandise-panel">
      <p className="eyebrow">Merchandising</p>
      <h1>Editar producto</h1>
      <MerchandiseItemForm
        mode="edit"
        itemId={item.id}
        initialImageUrl={getPublicMerchandiseImageUrl(item.imagePath)}
        initialValues={{
          name: item.name,
          description: item.description ?? "",
          price: Number(item.price),
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          temporaryImageId: null,
        }}
      />
    </section>
  );
}
