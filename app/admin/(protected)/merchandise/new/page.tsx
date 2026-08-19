import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { MerchandiseItemForm } from "@/components/admin/merchandise/merchandise-item-form";
import { requireOwner } from "@/lib/auth";

export default async function NewMerchandiseItemPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  return (
    <section className="admin-panel admin-merchandise-panel">
      <p className="eyebrow">Merchandising</p>
      <h1>Nuevo producto</h1>
      <MerchandiseItemForm mode="create" />
    </section>
  );
}
