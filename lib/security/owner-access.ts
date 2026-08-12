export function getOwnerAccessDenial(
  status: "unauthenticated" | "forbidden" | "session-expired" | "configuration",
) {
  if (status === "forbidden" || status === "session-expired") {
    return { status: 403, message: "No tenés permisos para esta operación." } as const;
  }
  if (status === "configuration") {
    return { status: 503, message: "El servicio no está disponible temporalmente." } as const;
  }
  return { status: 401, message: "Tu sesión no es válida o venció." } as const;
}
