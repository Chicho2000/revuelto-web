import Link from "next/link";
import type { Ingredient } from "@/generated/prisma/client";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { IngredientStatusButton } from "@/components/admin/ingredients/ingredient-status-button";
import { requireOwner } from "@/lib/auth";
import { ingredientCategories } from "@/lib/ingredients/schema";
import { getPrisma } from "@/lib/prisma";

export default async function AdminIngredientsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const params = await searchParams;
  let items: Ingredient[] = [];
  let migrationPending = false;
  try {
    items = await getPrisma().ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }, { id: "asc" }] });
  } catch (error) {
    migrationPending = typeof error === "object" && error !== null && "code" in error &&
      (error.code === "P2021" || error.code === "P2022");
    if (!migrationPending) throw error;
  }

  return (
    <section className="admin-panel merchandise-admin-page">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Catálogo global</p>
          <h1>Ingredientes</h1>
          <p>Administrá los ingredientes que después podrás elegir para cada Revuelto.</p>
        </div>
        {!migrationPending && <Link className="admin-primary-link" href="/admin/ingredients/new">Nuevo ingrediente</Link>}
      </div>
      {params.message === "created" && <p className="admin-success">El ingrediente se creó correctamente.</p>}
      {params.message === "updated" && <p className="admin-success">Los cambios se guardaron.</p>}
      {params.message === "activated" && <p className="admin-success">El ingrediente quedó activo.</p>}
      {params.message === "deactivated" && <p className="admin-success">El ingrediente quedó inactivo.</p>}

      {migrationPending ? (
        <div className="admin-empty-state">
          <h2>Ingredientes estará disponible al aplicar las migraciones pendientes.</h2>
          <p>El catálogo todavía no está cargado en la base de datos.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-empty-state">
          <h2>Todavía no hay ingredientes.</h2>
          <p>Creá el primero para preparar las recetas de la nueva carta.</p>
        </div>
      ) : (
        <div className="admin-merchandise-list">
          {items.map((item) => {
            const category = ingredientCategories.find((entry) => entry.value === item.category);
            return (
              <article className="admin-merchandise-card admin-ingredient-card" key={item.id}>
                <div>
                  <div className="admin-bowl-title-row">
                    <h2>{item.name}</h2>
                    <span className={item.isActive ? "status-active" : "status-inactive"}>
                      {item.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p>{category?.label ?? item.category}</p>
                  <div className="admin-bowl-actions">
                    <Link href={`/admin/ingredients/${item.id}/edit`}>Editar</Link>
                    <IngredientStatusButton ingredientId={item.id} isActive={item.isActive} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
