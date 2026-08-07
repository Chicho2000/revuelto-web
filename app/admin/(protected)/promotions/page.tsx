import Image from "next/image";
import Link from "next/link";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { PromotionStatusButton } from "@/components/admin/promotions/promotion-status-button";
import { requireOwner } from "@/lib/auth";
import { formatPromotionWeeklySchedule } from "@/lib/promotions/schema";
import { getPrisma } from "@/lib/prisma";

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  const promotions = await getPrisma().promotion.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  const { message } = await searchParams;

  return (
    <section className="admin-panel promotions-admin-page">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Contenido comercial</p>
          <h1>Promociones</h1>
          <p>Administrá campañas, días, horarios e imagen.</p>
        </div>
        <Link className="admin-primary-link" href="/admin/promotions/new">Nueva promoción</Link>
      </div>

      {message === "created" && <p className="admin-success">La promoción se creó correctamente.</p>}
      {message === "updated" && <p className="admin-success">Los cambios se guardaron.</p>}
      {message === "activated" && <p className="admin-success">La promoción quedó activa.</p>}
      {message === "deactivated" && <p className="admin-success">La promoción quedó inactiva y ya no se muestra públicamente.</p>}

      {promotions.length === 0 ? (
        <div className="admin-empty-state">
          <h2>Todavía no hay promociones.</h2>
          <p>Creá la primera para publicarla cuando corresponda.</p>
        </div>
      ) : (
        <div className="admin-promotion-list">
          {promotions.map((promotion) => (
              <article className="admin-promotion-card" key={promotion.id}>
                {promotion.imageUrl && (
                  <div className="admin-promotion-thumb">
                    <Image src={promotion.imageUrl} alt={promotion.title} width={240} height={135} />
                  </div>
                )}
                <div className="admin-promotion-copy">
                  <div className="admin-bowl-title-row">
                    <h2>{promotion.title}</h2>
                    <div className="admin-promotion-statuses">
                      <span className={promotion.isActive ? "status-active" : "status-inactive"}>
                        {promotion.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  </div>
                  <p>{promotion.description.length > 180
                    ? `${promotion.description.slice(0, 177)}…`
                    : promotion.description}</p>
                  <p><strong>Horario:</strong> {formatPromotionWeeklySchedule(promotion)}</p>
                  <div className="admin-bowl-actions">
                    <Link href={`/admin/promotions/${promotion.id}/edit`}>Editar</Link>
                    <PromotionStatusButton promotionId={promotion.id} isActive={promotion.isActive} />
                  </div>
                </div>
              </article>
          ))}
        </div>
      )}
    </section>
  );
}
