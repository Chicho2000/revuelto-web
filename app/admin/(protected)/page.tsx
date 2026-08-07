import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { requireOwner } from "@/lib/auth";

export default async function AdminPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  return (
    <section className="admin-panel">
      <p className="eyebrow">Resumen</p>
      <h1>Todo listo para organizar Revuelto.</h1>
      <p>
        En la siguiente etapa vas a poder administrar bowls, promociones,
        sucursales y los textos de la carta.
      </p>
    </section>
  );
}
