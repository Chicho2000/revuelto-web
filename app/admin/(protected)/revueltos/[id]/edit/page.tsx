import { notFound } from "next/navigation";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { RevueltoForm } from "@/components/admin/revueltos/revuelto-form";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function EditRevueltoPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const { id } = await params;
  const [revuelto, ingredients] = await Promise.all([
    getPrisma().bowl.findUnique({
      where: { id },
      include: {
        recipeIngredients: { orderBy: { sortOrder: "asc" } },
        choiceGroups: { include: { options: { orderBy: { sortOrder: "asc" } }, }, orderBy: { sortOrder: "asc" } },
      },
    }),
    getPrisma().ingredient.findMany({
      select: { id: true, name: true, category: true, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);
  if (!revuelto) notFound();

  return (
    <section className="admin-panel admin-revuelto-panel">
      <p className="eyebrow">Nueva carta · 20 oz</p>
      <h1>Editar Revuelto</h1>
      <RevueltoForm
        mode="edit"
        revueltoId={revuelto.id}
        ingredients={ingredients}
        initialImageUrl={revuelto.imageUrl}
        hasExistingImage={Boolean(revuelto.imagePath)}
        initialValues={{
          name: revuelto.name,
          kind: revuelto.kind,
          description: revuelto.description,
          price: revuelto.price ? Number(revuelto.price) : null,
          displayOrder: revuelto.displayOrder,
          isVisibleInNewMenu: revuelto.isVisibleInNewMenu,
          recipeIngredients: revuelto.recipeIngredients.map((item) => ({
            ingredientId: item.ingredientId,
            sortOrder: item.sortOrder,
            isRemovable: item.isRemovable,
          })),
          choiceGroups: revuelto.choiceGroups.map((group) => ({
            code: group.code as "breakfast-protein" | "protein" | "vegetables" | "seed-nut" | "sauce",
            label: group.label,
            category: group.category as "PROTEIN" | "VEGETABLE" | "SEED_NUT" | "SAUCE",
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: group.sortOrder,
            options: group.options.map((option) => ({ ingredientId: option.ingredientId, sortOrder: option.sortOrder })),
          })),
          temporaryImageId: null,
          removeImage: false,
        }}
      />
    </section>
  );
}
