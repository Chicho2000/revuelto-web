import "server-only";
import { redirect } from "next/navigation";
import { getServerSecurityEnvironment, getSupabaseEnvironment, hasDatabaseRuntimeConfiguration } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { getActiveAdminSession } from "@/lib/security/admin-session";
import { isActiveOwner } from "@/lib/security/authorization";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type OwnerAccess =
  | {
      status: "owner";
      adminUser: { id: string; name: string; authUserId: string };
      absoluteSessionExpiresAt: Date;
    }
  | { status: "configuration" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "session-expired" };

export async function findOwnerAdminUser(authUserId: string) {
  const adminUser = await getPrisma().adminUser.findUnique({
    where: { authUserId },
    select: { id: true, name: true, authUserId: true, role: true, isActive: true },
  });

  if (!adminUser || !isActiveOwner(adminUser)) return null;
  return { id: adminUser.id, name: adminUser.name, authUserId: adminUser.authUserId };
}

export async function getOwnerAccess(): Promise<OwnerAccess> {
  if (!getSupabaseEnvironment() || !hasDatabaseRuntimeConfiguration() || !getServerSecurityEnvironment()) {
    return { status: "configuration" };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { status: "configuration" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { status: "unauthenticated" };

  const adminUser = await findOwnerAdminUser(user.id);
  if (!adminUser) {
    return { status: "forbidden" };
  }

  const adminSession = await getActiveAdminSession(adminUser.id);
  if (!adminSession) {
    return { status: "session-expired" };
  }

  return {
    status: "owner",
    adminUser,
    absoluteSessionExpiresAt: adminSession.absoluteExpiresAt,
  };
}

// Usar este helper en cada Server Action o Route Handler administrativo futuro.
export async function requireOwner() {
  const access = await getOwnerAccess();

  if (access.status === "unauthenticated") redirect("/admin/login");
  if (access.status === "forbidden") redirect("/admin/login?error=forbidden");
  if (access.status === "session-expired") redirect("/admin/login?message=session-expired");

  return access;
}
