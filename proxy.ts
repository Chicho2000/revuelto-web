import { NextResponse, type NextRequest } from "next/server";
import { isProtectedAdminHandlerPath } from "@/lib/security/admin-handler-paths";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSupabaseSession(request);
  const isLoginRoute = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  // /admin/login siempre es pública. En particular, no se redirige a /admin:
  // un usuario autenticado sin rol OWNER debe poder volver a ver el mensaje.
  if (isLoginRoute) return response;

  // Sensitive Route Handlers perform their own full OWNER authorization and
  // must be allowed to return JSON 401/403 instead of a navigation redirect.
  if (isProtectedAdminHandlerPath(pathname)) return response;

  if (pathname.startsWith("/admin") && !user) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
