import "server-only";
import { NextResponse } from "next/server";
import { getOwnerAccess } from "@/lib/auth";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { getOwnerAccessDenial } from "@/lib/security/owner-access";

type OwnerAccess = Extract<Awaited<ReturnType<typeof getOwnerAccess>>, { status: "owner" }>;

type OwnerRouteAuthorization =
  | { access: OwnerAccess; response: null }
  | { access: null; response: NextResponse };

// Route Handlers must use this in addition to the navigation proxy. A copied
// URL, Postman request, or custom client cannot bypass this server-side check.
export async function getOwnerRouteAuthorization(): Promise<OwnerRouteAuthorization> {
  let access: Awaited<ReturnType<typeof getOwnerAccess>>;
  try {
    access = await getOwnerAccess();
  } catch (error) {
    reportUnexpectedServerError("authorization", error);
    return {
      access: null,
      response: NextResponse.json({ error: "Ocurrió un error. Intentá nuevamente." }, { status: 500 }),
    };
  }
  if (access.status === "owner") return { access, response: null };

  const denial = getOwnerAccessDenial(access.status);
  return {
    access: null,
    response: NextResponse.json({ error: denial.message }, { status: denial.status }),
  };
}
