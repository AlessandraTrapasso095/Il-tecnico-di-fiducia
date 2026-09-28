"use client";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "content-type": "application/json",
    },
    credentials: init.credentials ?? "same-origin",
  });

  const payload = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const serverMessage = (payload as { error?: string } | null)?.error;

    const message =
      res.status >= 500
        ? "Si è verificato un problema del servizio. Riprova tra qualche istante."
        : (serverMessage ?? `Request failed (${res.status})`);

    throw new ApiError(message, res.status);
  }

  return payload as T;
}
