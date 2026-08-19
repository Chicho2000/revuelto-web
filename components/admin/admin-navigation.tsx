import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "@/components/admin/logout-button";

const links = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/bowls", label: "Bowls" },
  { href: "/admin/promotions", label: "Promociones" },
  { href: "/admin/branches", label: "Sucursales" },
  { href: "/admin/content", label: "Contenido" },
  { href: "/admin/merchandise", label: "Merchandising" },
];

export function AdminNavigation({ name }: { name: string }) {
  return (
    <header className="admin-header">
      <Link href="/admin" aria-label="Ir al inicio del panel de Revuelto">
        <Image
          src="/brand/logos/logo-horizontal.svg"
          alt="Revuelto"
          className="admin-logo"
          width={560}
          height={210}
        />
      </Link>
      <nav aria-label="Navegación administrativa">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="admin-owner"><span>{name}</span><LogoutButton /></div>
    </header>
  );
}
