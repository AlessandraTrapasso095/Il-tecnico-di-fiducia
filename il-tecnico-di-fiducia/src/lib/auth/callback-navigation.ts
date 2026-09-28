export function safeAuthCallbackNextPath(value: string | null | undefined) {
  if (!value) return "/";

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }

  let parsed: URL;

  try {
    parsed = new URL(value, "https://local.invalid");
  } catch {
    return "/";
  }

  if (parsed.origin !== "https://local.invalid") {
    return "/";
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
