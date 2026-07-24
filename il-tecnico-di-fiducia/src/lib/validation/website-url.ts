const websiteHostnamePattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function normalizeWebsiteUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const clean = value.trim();
  if (!clean) return null;

  const candidate = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (!websiteHostnamePattern.test(url.hostname)) return undefined;
  if (url.username || url.password) return undefined;

  url.hash = "";
  return url.toString();
}

export function formatWebsiteUrlLabel(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./i, "");
    const suffix = `${url.pathname}${url.search}`.replace(/\/$/, "");
    return suffix && suffix !== "/" ? `${hostname}${suffix}` : hostname;
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}
