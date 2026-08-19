import Image from "next/image";
import Link from "next/link";
import type { MerchandiseItem } from "@/generated/prisma/client";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { MerchandiseStatusButton } from "@/components/admin/merchandise/merchandise-status-button";
import { requireOwner } from "@/lib/auth";
import { getPublicMerchandiseImageUrl } from "@/lib/merchandise/public-image";
import { getPrisma } from "@/lib/prisma";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default async function AdminMerchandisePage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const params = await searchParams;
  let items: MerchandiseItem[] = [];
  let migrationPending = false;
  try {
    items = await getPrisma().merchandiseItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  } catch (error) {
    migrationPending = typeof error === "object" && error !== null && "code" in error && error.code === "P2021";
    if (!migrationPending) throw error;
  }

  return (
    <section className="admin-panel merchandise-admin-page">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1>Merchandising</h1>
          <p>Administrá productos, precios, imágenes y orden de aparición.</p>
        </div>
        {!migrationPending && <Link className="admin-primary-link" href="/admin/merchandise/new">Nuevo producto</Link>}
      </div>

      {params.message === "created" && <p className="admin-success">El producto se creó correctamente.</p>}
      {params.message === "updated" && <p className="admin-success">Los cambios se guardaron.</p>}
      {params.message === "activated" && <p className="admin-success">El producto quedó activo.</p>}
      {params.message === "deactivated" && <p className="admin-success">El producto quedó inactivo.</p>}

      {migrationPending ? (
        <div className="admin-empty-state">
          <h2>Merchandising estará disponible al aplicar la migración pendiente.</h2>
          <p>La web pública lo mantiene completamente oculto hasta entonces.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-empty-state">
          <h2>Todavía no hay productos.</h2>
          <p>Creá el primero para comenzar la vidriera de merchandising.</p>
        </div>
      ) : (
        <div className="admin-merchandise-list">
          {items.map((item) => {
            const imageUrl = getPublicMerchandiseImageUrl(item.imagePath);
            return (
              <article className="admin-merchandise-card" key={item.id}>
                <div className="admin-merchandise-thumb">
                  {imageUrl ? <Image src={imageUrl} alt={item.name} width={320} height={240} /> : <span>Imagen no disponible</span>}
                </div>
                <div>
                  <div className="admin-bowl-title-row">
                    <h2>{item.name}</h2>
                    <span className={item.isActive ? "status-active" : "status-inactive"}>{item.isActive ? "Activo" : "Inactivo"}</span>
                  </div>
                  <p>{item.description || "Sin descripción."}</p>
                  <dl className="admin-gallery-details">
                    <div><dt>Precio</dt><dd>{currencyFormatter.format(Number(item.price))}</dd></div>
                    <div><dt>Orden</dt><dd>{item.sortOrder}</dd></div>
                  </dl>
                  <div className="admin-bowl-actions">
                    <Link href={`/admin/merchandise/${item.id}/edit`}>Editar</Link>
                    <MerchandiseStatusButton itemId={item.id} isActive={item.isActive} />
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
