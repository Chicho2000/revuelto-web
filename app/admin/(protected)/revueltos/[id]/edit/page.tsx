import { notFound } from "next/navigation";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { RevueltoForm } from "@/components/admin/revueltos/revuelto-form";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { menuCategories } from "@/lib/menu-categories";

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
        drinkOptions: { orderBy: { sortOrder: "asc" } },
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
      <p className="eyebrow">Nueva carta</p>
      <h1>Editar {menuCategories[revuelto.menuCategory].singular}</h1>
      <RevueltoForm
        mode="edit"
        revueltoId={revuelto.id}
        category={revuelto.menuCategory}
        ingredients={ingredients}
        initialImageUrl={revuelto.imageUrl}
        hasExistingImage={Boolean(revuelto.imagePath)}
        initialValues={{
          name: revuelto.name,
          menuCategory: revuelto.menuCategory,
          kind: revuelto.kind,
          description: revuelto.description,
          price: revuelto.price ? Number(revuelto.price) : null,
          comboPrice: revuelto.comboPrice ? Number(revuelto.comboPrice) : null,
          displayOrder: revuelto.displayOrder,
          isVisibleInNewMenu: revuelto.isVisibleInNewMenu,
          recipeIngredients: revuelto.recipeIngredients.map((item) => ({
            ingredientId: item.ingredientId,
            sortOrder: item.sortOrder,
            isRemovable: item.isRemovable,
          })),
          choiceGroups: (revuelto.menuCategory === "BEBIDA" ? [] : revuelto.choiceGroups).map((group) => ({
            code: group.code as "breakfast-protein" | "protein" | "vegetables" | "seed-nut" | "sauce" | "drink-variant",
            label: group.label,
            category: group.category as "PROTEIN" | "VEGETABLE" | "SEED_NUT" | "SAUCE" | "OTHER",
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: group.sortOrder,
            options: group.options.map((option) => ({ ingredientId: option.ingredientId, sortOrder: option.sortOrder })),
          })),
          drinkOptions: revuelto.drinkOptions.map((option) => ({ name: option.name, sortOrder: option.sortOrder })),
          temporaryImageId: null,
          removeImage: false,
        }}
      />
    </section>
  );
}
