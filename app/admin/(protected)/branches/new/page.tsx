import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { BranchForm } from "@/components/admin/branches/branch-form";
import { requireOwner } from "@/lib/auth";

export default async function NewBranchPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  return (
    <section className="admin-panel admin-branch-panel">
      <p className="eyebrow">Sucursales</p>
      <h1>Nueva sucursal</h1>
      <BranchForm mode="create" />
    </section>
  );
}
