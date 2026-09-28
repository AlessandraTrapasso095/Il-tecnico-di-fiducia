export const CANONICAL_SITE_URL = "https://www.iltecnicodifiducia.it";

export function absoluteSiteUrl(path = "/") {
  return new URL(path, `${CANONICAL_SITE_URL}/`).toString();
}
