import { notFound } from "next/navigation";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { GalleryItemForm } from "@/components/admin/gallery/gallery-item-form";
import { requireOwner } from "@/lib/auth";
import { getPublicGalleryImageUrl } from "@/lib/gallery/public-image";
import { getPrisma } from "@/lib/prisma";

export default async function EditGalleryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const { id } = await params;
  const item = await getPrisma().galleryItem.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <section className="admin-panel admin-gallery-panel">
      <p className="eyebrow">Galería</p>
      <h1>Editar elemento</h1>
      <GalleryItemForm
        mode="edit"
        galleryItemId={item.id}
        initialImageUrl={getPublicGalleryImageUrl(item.imagePath)}
        initialValues={{
          type: item.type,
          title: item.title ?? "",
          description: item.description ?? "",
          externalUrl: item.externalUrl ?? "",
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          temporaryImageId: null,
        }}
      />
    </section>
  );
}
