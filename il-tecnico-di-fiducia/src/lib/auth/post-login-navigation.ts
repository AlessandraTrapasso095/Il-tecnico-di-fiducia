export function toPostLoginUrl(
  destination: string,
  origin: string,
) {
  return new URL(destination, origin).toString();
}

export function navigateAfterLogin(destination: string) {
  const url = toPostLoginUrl(destination, window.location.origin);

  // A full document navigation guarantees that the next server-rendered
  // request sees the auth cookies returned by the sign-in response.
  window.location.replace(url);
}
