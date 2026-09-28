type LoginRole = "customer" | "professional" | "admin";

function belongsToArea(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function isAllowedPublicResumePath(pathname: string) {
  return belongsToArea(pathname, "/professionisti");
}

export function safeNextPathForRole(
  value: string | null | undefined,
  role: LoginRole,
) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;

  let parsed: URL;

  try {
    parsed = new URL(value, "https://local.invalid");
  } catch {
    return null;
  }

  if (parsed.origin !== "https://local.invalid") return null;

  const pathname = parsed.pathname;

  if (isAllowedPublicResumePath(pathname)) {
    return `${pathname}${parsed.search}${parsed.hash}`;
  }

  if (role === "customer" && belongsToArea(pathname, "/customer")) {
    return `${pathname}${parsed.search}${parsed.hash}`;
  }

  if (role === "professional" && belongsToArea(pathname, "/professionista")) {
    return `${pathname}${parsed.search}${parsed.hash}`;
  }

  if (role === "admin" && belongsToArea(pathname, "/admin")) {
    return `${pathname}${parsed.search}${parsed.hash}`;
  }

  return null;
}

export function toPostLoginUrl(destination: string, origin: string) {
  return new URL(destination, origin).toString();
}

export function navigateAfterLogin(destination: string) {
  const url = toPostLoginUrl(destination, window.location.origin);

  // A full document navigation guarantees that the next server-rendered
  // request sees the auth cookies returned by the sign-in response.
  window.location.replace(url);
}
