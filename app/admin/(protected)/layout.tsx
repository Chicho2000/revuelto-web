import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { getOwnerAccess } from "@/lib/auth";
import { InactivityGuard } from "@/components/admin/inactivity-guard";
import { SessionExpired } from "@/components/admin/session-expired";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getOwnerAccess();

  if (access.status === "configuration") {
    return <AdminConfigurationState />;
  }
  if (access.status === "unauthenticated" || access.status === "forbidden") redirect("/admin/login");
  if (access.status === "session-expired") return <SessionExpired />;

  return (
    <div className="admin-shell">
      <AdminNavigation name={access.adminUser.name} />
      <InactivityGuard absoluteExpiresAt={access.absoluteSessionExpiresAt.toISOString()} />
      <main className="admin-content">{children}</main>
    </div>
  );
}
