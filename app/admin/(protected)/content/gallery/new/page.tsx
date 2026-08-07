import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { GalleryItemForm } from "@/components/admin/gallery/gallery-item-form";
import { requireOwner } from "@/lib/auth";

export default async function NewGalleryItemPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  return (
    <section className="admin-panel admin-gallery-panel">
      <p className="eyebrow">Galería</p>
      <h1>Nuevo elemento</h1>
      <GalleryItemForm mode="create" />
    </section>
  );
}
