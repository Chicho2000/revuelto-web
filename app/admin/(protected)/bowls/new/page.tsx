import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { BowlForm } from "@/components/admin/bowls/bowl-form";
import { requireOwner } from "@/lib/auth";

export default async function NewBowlPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  return (
    <section className="admin-panel">
      <p className="eyebrow">Productos</p>
      <h1>Nuevo bowl</h1>
      <BowlForm mode="create" />
    </section>
  );
}
