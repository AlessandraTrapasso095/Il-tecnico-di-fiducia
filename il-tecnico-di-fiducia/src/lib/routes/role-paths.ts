export type AppRole = "customer" | "professional" | "admin";

export function nextPathByRole(role: AppRole) {
  if (role === "admin") return "/admin";
  if (role === "professional") return "/professionista";
  return "/customer";
}

export function routeBelongsToRole(path: string, role: AppRole) {
  const pathname = path.split(/[?#]/, 1)[0] || "/";

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return role === "admin";
  }

  if (
    pathname === "/professionista" ||
    pathname.startsWith("/professionista/") ||
    pathname === "/professional" ||
    pathname.startsWith("/professional/")
  ) {
    return role === "professional";
  }

  if (pathname === "/customer" || pathname.startsWith("/customer/")) {
    return role === "customer";
  }

  return true;
}
