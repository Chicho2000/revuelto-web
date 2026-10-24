import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { IngredientForm } from "@/components/admin/ingredients/ingredient-form";
import { requireOwner } from "@/lib/auth";

export default async function NewIngredientPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  return (
    <section className="admin-panel admin-merchandise-panel">
      <p className="eyebrow">Ingredientes</p>
      <h1>Nuevo ingrediente</h1>
      <IngredientForm mode="create" />
    </section>
  );
}
