const protectedAdminHandlerPrefixes = [
  "/admin/bowls/manage",
  "/admin/branches/manage",
  "/admin/promotions/manage",
  "/admin/content/manage",
  "/admin/content/gallery/manage",
  "/admin/images",
  "/admin/session/activity",
] as const;

export function isProtectedAdminHandlerPath(pathname: string) {
  return protectedAdminHandlerPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
