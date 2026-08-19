import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { requireOwner } from "@/lib/auth";
import Link from "next/link";

const adminSections = [
  { href: "/admin/bowls", title: "Carta", description: "Administrá bowls, precios e imágenes." },
  { href: "/admin/promotions", title: "Promociones", description: "Creá, programá y activá promociones." },
  { href: "/admin/branches", title: "Sucursales", description: "Administrá locales y horarios." },
  { href: "/admin/content", title: "Contenido", description: "Editá textos, redes, SEO y galería." },
  { href: "/admin/merchandise", title: "Merchandising", description: "Administrá tote bags, pins, remeras y otros artículos." },
] as const;

export default async function AdminPage() {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  return (
    <section className="admin-panel admin-dashboard">
      <p className="eyebrow">Resumen</p>
      <h1>Administrá Revuelto.</h1>
      <p>Elegí una sección para empezar.</p>
      <div className="admin-dashboard-grid">
        {adminSections.map((section) => (
          <Link className="admin-dashboard-card" href={section.href} key={section.href}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <span>Entrar →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
