export function isActiveOwner(user: { role: string; isActive: boolean }) {
  return user.role === "OWNER" && user.isActive;
}
