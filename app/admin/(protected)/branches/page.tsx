import Link from "next/link";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { BranchStatusButton } from "@/components/admin/branches/branch-status-button";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { requireOwner } from "@/lib/auth";
import { BRANCH_DAY_LABELS, sortByBranchDay } from "@/lib/branches/schema";
import { getPrisma } from "@/lib/prisma";

export default async function AdminBranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  const branches = await getPrisma().branch.findMany({
    include: { businessHours: true },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });
  const { message } = await searchParams;

  return (
    <section className="admin-panel branches-admin-page">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Locales</p>
          <h1>Sucursales</h1>
          <p>Administrá datos, horarios y disponibilidad.</p>
        </div>
        <Link className="admin-primary-link" href="/admin/branches/new">Nueva sucursal</Link>
      </div>

      {message === "created" && <p className="admin-success">La sucursal se creó correctamente.</p>}
      {message === "updated" && <p className="admin-success">Los cambios se guardaron.</p>}
      {message === "activated" && <p className="admin-success">La sucursal quedó activa.</p>}
      {message === "deactivated" && <p className="admin-success">La sucursal quedó inactiva y ya no se muestra públicamente.</p>}
      {message === "deleted" && <p className="admin-success">La sucursal se borró definitivamente.</p>}

      {branches.length === 0 ? (
        <div className="admin-empty-state">
          <h2>Todavía no hay sucursales.</h2>
          <p>Creá la primera para publicar dónde encontrar Revuelto.</p>
        </div>
      ) : (
        <div className="admin-branch-list">
          {branches.map((branch) => (
            <article className="admin-branch-card" key={branch.id}>
              <div className="admin-bowl-title-row">
                <div>
                  <h2>{branch.name}</h2>
                  <p>{branch.address} · {branch.city}</p>
                  {branch.whatsappNumber && <p>Teléfono: {branch.whatsappNumber}</p>}
                </div>
                <span className={branch.isActive ? "status-active" : "status-inactive"}>
                  {branch.isActive ? "Activa" : "Inactiva"}
                </span>
              </div>

              <ul className="admin-branch-schedule-summary">
                {sortByBranchDay(branch.businessHours).map((hour) => (
                  <li key={hour.id}>
                    <strong>{BRANCH_DAY_LABELS[hour.dayOfWeek]}:</strong>{" "}
                    {hour.isClosed ? "Cerrado" : `${hour.openingTime} a ${hour.closingTime}`}
                  </li>
                ))}
              </ul>

              <div className="admin-bowl-actions">
                <Link href={`/admin/branches/${branch.id}/edit`}>Editar</Link>
                <BranchStatusButton branchId={branch.id} isActive={branch.isActive} />
                <DeleteEntityButton
                  endpoint={`/admin/branches/manage/${branch.id}`}
                  entityLabel="sucursal"
                  entityName={branch.name}
                  redirectTo="/admin/branches"
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
