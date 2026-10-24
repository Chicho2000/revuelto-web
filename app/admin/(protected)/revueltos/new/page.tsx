import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { RevueltoForm } from "@/components/admin/revueltos/revuelto-form";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function NewRevueltoPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const ingredients = await getPrisma().ingredient.findMany({
    select: { id: true, name: true, category: true, isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return (
    <section className="admin-panel admin-revuelto-panel">
      <p className="eyebrow">Nueva carta · 20 oz</p>
      <h1>Nuevo Revuelto</h1>
      <RevueltoForm mode="create" ingredients={ingredients} />
    </section>
  );
}
