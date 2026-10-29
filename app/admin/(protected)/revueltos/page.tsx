import Image from "next/image";
import Link from "next/link";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { menuCategories, parseMenuCategory } from "@/lib/menu-categories";

export default async function AdminRevueltosPage({ searchParams }: { searchParams: Promise<{ message?: string; category?: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const { message, category: rawCategory } = await searchParams;
  const category = parseMenuCategory(rawCategory);
  const title = menuCategories[category].label;
  const revueltos = await getPrisma().bowl.findMany({
    where: { isArchived: false, menuCategory: category, ...(category === "BEBIDA" ? {} : { recipeIngredients: { some: {} } }) },
    include: { recipeIngredients: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <section className="admin-panel revueltos-admin-page">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Nueva carta</p>
          <h1>{title}</h1>
          <p>{category === "BEBIDA" ? "Cargá nombre, descripción, precio y foto de cada bebida." : "Configurá cada receta, sus ingredientes y qué elementos puede quitar el cliente."}</p>
        </div>
        <Link className="admin-primary-link" href={`/admin/revueltos/new?category=${category}`}>Nuevo {menuCategories[category].singular}</Link>
      </div>
      {message === "created" && <p className="admin-success">{menuCategories[category].singular} creado correctamente.</p>}
      {message === "updated" && <p className="admin-success">Los cambios se guardaron.</p>}

      {revueltos.length === 0 ? (
        <div className="admin-empty-state">
          <h2>Todavía no hay {title} configurados.</h2>
          <p>{category === "BEBIDA" ? "Cargá la primera bebida desde este panel." : "Primero cargá los ingredientes globales y después armá cada receta."}</p>
        </div>
      ) : (
        <div className="admin-bowl-list">
          {revueltos.map((revuelto) => (
            <article className="admin-bowl-card" key={revuelto.id}>
              <div className="admin-bowl-thumb">
                {revuelto.imageUrl ? <Image src={revuelto.imageUrl} alt={revuelto.name} width={180} height={180} /> : <span>Sin foto</span>}
              </div>
              <div className="admin-bowl-card-copy">
                <div className="admin-bowl-title-row">
                  <div>
                    <h2>{revuelto.name}</h2>
                    <p>{revuelto.kind === "CUSTOM" ? "Tu Revuelto" : category === "BEBIDA" ? "Bebida" : "Receta definida"}</p>
                  </div>
                  <span className={revuelto.isVisibleInNewMenu ? "status-active" : "status-inactive"}>
                    {revuelto.isVisibleInNewMenu ? "Visible en nueva carta" : "Borrador"}
                  </span>
                </div>
                <p>{revuelto.description}</p>
                <div className="admin-bowl-prices">
                  <span>{revuelto.price ? <><strong>${revuelto.price.toString()}</strong></> : "Precio pendiente"}</span>
                  {category === "REVUELTITO" && revuelto.comboPrice && <span>Con café o agua: ${revuelto.comboPrice.toString()}</span>}
                  <span>{revuelto.recipeIngredients.length} ingrediente{revuelto.recipeIngredients.length === 1 ? "" : "s"} en receta</span>
                </div>
                <div className="admin-bowl-actions">
                  <Link href={`/admin/revueltos/${revuelto.id}/edit`}>Editar</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
