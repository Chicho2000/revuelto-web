import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { IngredientForm } from "@/components/admin/ingredients/ingredient-form";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function EditIngredientPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const item = await getPrisma().ingredient.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <section className="admin-panel admin-merchandise-panel">
      <p className="eyebrow">Ingredientes</p>
      <h1>Editar ingrediente</h1>
      <IngredientForm
        mode="edit"
        ingredientId={item.id}
        initialValues={{
          name: item.name,
          category: item.category,
          isActive: item.isActive,
        }}
      />
    </section>
  );
}
