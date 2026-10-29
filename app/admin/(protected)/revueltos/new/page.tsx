import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { RevueltoForm } from "@/components/admin/revueltos/revuelto-form";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { menuCategories, parseMenuCategory } from "@/lib/menu-categories";

export default async function NewRevueltoPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const category = parseMenuCategory((await searchParams).category);
  const ingredients = await getPrisma().ingredient.findMany({
    select: { id: true, name: true, category: true, isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return (
    <section className="admin-panel admin-revuelto-panel">
      <p className="eyebrow">Nueva carta</p>
      <h1>Nuevo {menuCategories[category].singular}</h1>
      <RevueltoForm mode="create" category={category} ingredients={ingredients} />
    </section>
  );
}
