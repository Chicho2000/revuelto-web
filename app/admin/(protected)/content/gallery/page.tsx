import Image from "next/image";
import Link from "next/link";
import type { GalleryItem } from "@/generated/prisma/client";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { GalleryStatusButton } from "@/components/admin/gallery/gallery-status-button";
import { requireOwner } from "@/lib/auth";
import { getPublicGalleryImageUrl } from "@/lib/gallery/public-image";
import { getPrisma } from "@/lib/prisma";

function summarizeUrl(value: string | null) {
  if (!value) return "—";
  return value.length > 54 ? `${value.slice(0, 51)}…` : value;
}

export default async function AdminGalleryPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;
  const params = await searchParams;
  let items: GalleryItem[] = [];
  let migrationPending = false;
  try {
    items = await getPrisma().galleryItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  } catch (error) {
    migrationPending = typeof error === "object" && error !== null && "code" in error && error.code === "P2021";
    if (!migrationPending) throw error;
  }

  return (
    <section className="admin-panel gallery-admin-page">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Contenido multimedia</p>
          <h1>Galería</h1>
          <p>Administrá fotos y enlaces a videos de Instagram.</p>
        </div>
        {!migrationPending && <Link className="admin-primary-link" href="/admin/content/gallery/new">Nuevo elemento</Link>}
      </div>
      <div className="admin-gallery-back">
        <Link className="admin-primary-link admin-back-link" href="/admin/content">← Volver a contenido general</Link>
      </div>
      {params.message === "created" && <p className="admin-success">El elemento se creó correctamente.</p>}
      {params.message === "updated" && <p className="admin-success">Los cambios se guardaron.</p>}
      {params.message === "activated" && <p className="admin-success">El elemento quedó activo.</p>}
      {params.message === "deactivated" && <p className="admin-success">El elemento quedó inactivo.</p>}

      {migrationPending ? (
        <div className="admin-empty-state">
          <h2>La galería estará disponible al aplicar la migración pendiente.</h2>
          <p>La página pública sigue funcionando con la galería oculta hasta entonces.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-empty-state">
          <h2>Todavía no hay elementos.</h2>
          <p>Creá la primera foto o miniatura de Instagram.</p>
        </div>
      ) : (
        <div className="admin-gallery-list">
          {items.map((item) => {
            const imageUrl = getPublicGalleryImageUrl(item.imagePath);
            return (
              <article className="admin-gallery-card" key={item.id}>
                <div className="admin-gallery-thumb">
                  {imageUrl ? <Image src={imageUrl} alt={item.title ?? "Elemento de galería"} width={320} height={240} /> : <span>Imagen no disponible</span>}
                  {item.type === "INSTAGRAM_VIDEO" && <span className="admin-play-indicator" aria-label="Video">▶</span>}
                </div>
                <div>
                  <div className="admin-bowl-title-row">
                    <h2>{item.title || "Sin título"}</h2>
                    <span className={item.isActive ? "status-active" : "status-inactive"}>{item.isActive ? "Activo" : "Inactivo"}</span>
                  </div>
                  <dl className="admin-gallery-details">
                    <div><dt>Tipo</dt><dd>{item.type === "IMAGE" ? "Imagen" : "Video de Instagram"}</dd></div>
                    <div><dt>Enlace</dt><dd title={item.externalUrl ?? undefined}>{summarizeUrl(item.externalUrl)}</dd></div>
                    <div><dt>Orden</dt><dd>{item.sortOrder}</dd></div>
                  </dl>
                  <div className="admin-bowl-actions">
                    <Link href={`/admin/content/gallery/${item.id}/edit`}>Editar</Link>
                    <GalleryStatusButton galleryItemId={item.id} isActive={item.isActive} />
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
