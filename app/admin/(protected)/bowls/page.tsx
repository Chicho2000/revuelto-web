import Image from "next/image";
import Link from "next/link";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { BowlStatusButton } from "@/components/admin/bowls/bowl-status-button";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function AdminBowlsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  const bowls = await getPrisma().bowl.findMany({
    where: { isArchived: false },
    include: { sizes: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
  const { message } = await searchParams;

  return (
    <section className="admin-panel bowls-admin-page">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Productos</p>
          <h1>Bowls</h1>
          <p>Administrá recetas, precios, disponibilidad e imagen.</p>
        </div>
        <Link className="admin-primary-link" href="/admin/bowls/new">Nuevo bowl</Link>
      </div>

      {message === "created" && <p className="admin-success">El bowl se creó correctamente.</p>}
      {message === "updated" && <p className="admin-success">Los cambios se guardaron.</p>}
      {message === "deleted" && <p className="admin-success">El bowl se borró definitivamente.</p>}

      {bowls.length === 0 ? (
        <div className="admin-empty-state">
          <h2>Todavía no hay bowls.</h2>
          <p>Creá el primero para comenzar a completar la carta.</p>
        </div>
      ) : (
        <div className="admin-bowl-list">
          {bowls.map((bowl) => {
            const small = bowl.sizes.find((size) => size.size === "SMALL");
            const large = bowl.sizes.find((size) => size.size === "LARGE");
            return (
              <article className="admin-bowl-card" key={bowl.id}>
                <div className="admin-bowl-thumb">
                  {bowl.imageUrl ? (
                    <Image src={bowl.imageUrl} alt={bowl.name} width={180} height={180} />
                  ) : (
                    <span>Sin imagen</span>
                  )}
                </div>
                <div className="admin-bowl-card-copy">
                  <div className="admin-bowl-title-row">
                    <div>
                      <h2>{bowl.name}</h2>
                      <code>{bowl.slug}</code>
                    </div>
                    <span className={bowl.isAvailable ? "status-active" : "status-inactive"}>
                      {bowl.isAvailable ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p>{bowl.description || "Sin descripción."}</p>
                  <div className="admin-bowl-prices">
                    <span>SMALL · 25 oz <strong>${small?.price.toString() ?? "—"}</strong></span>
                    <span>LARGE · 35 oz <strong>${large?.price.toString() ?? "—"}</strong></span>
                  </div>
                  <div className="admin-bowl-actions">
                    <Link href={`/admin/bowls/${bowl.id}/edit`}>Editar</Link>
                    <BowlStatusButton bowlId={bowl.id} isActive={bowl.isAvailable} />
                    <DeleteEntityButton
                      endpoint={`/admin/bowls/manage/${bowl.id}`}
                      entityLabel="bowl"
                      entityName={bowl.name}
                      redirectTo="/admin/bowls"
                    />
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
