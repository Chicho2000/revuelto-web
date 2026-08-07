import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { requireOwner } from "@/lib/auth";

export async function AdminComingSoon({ title }: { title: string }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  return (
    <section className="admin-panel">
      <p className="eyebrow">Próxima etapa</p>
      <h1>{title}</h1>
      <p>El CRUD se incorporará cuando se implementen los formularios administrativos.</p>
    </section>
  );
}
