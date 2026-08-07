import Link from "next/link";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { SiteContentForm } from "@/components/admin/content/site-content-form";
import { requireOwner } from "@/lib/auth";
import { getSiteContent } from "@/lib/content/service";

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  const [content, params] = await Promise.all([getSiteContent(), searchParams]);

  return (
    <section className="admin-panel admin-content-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">Página pública</p>
          <h1>Contenido general</h1>
          <p>Administrá textos, contacto, redes, footer y SEO.</p>
        </div>
        <Link className="admin-primary-link" href="/admin/content/gallery">Administrar galería</Link>
      </div>
      {params.message === "updated" && <p className="admin-success">Los cambios se guardaron correctamente.</p>}
      <SiteContentForm initialValues={content} />
    </section>
  );
}
