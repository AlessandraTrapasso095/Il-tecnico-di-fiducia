import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const appError = readFileSync("src/app/error.tsx", "utf8");
const globalError = readFileSync("src/app/global-error.tsx", "utf8");
const notFound = readFileSync("src/app/not-found.tsx", "utf8");

const fetchJson = readFileSync("src/lib/api/fetch-json.ts", "utf8");

const authCallback = readFileSync("src/app/auth/callback/route.ts", "utf8");

describe("global error handling contract", () => {
  it("has a recoverable root error boundary", () => {
    expect(appError).toContain('"use client"');
    expect(appError).toContain("reset");
    expect(appError).toContain("Si è verificato un problema");
    expect(appError).not.toContain("{error.message}");
  });

  it("has a fatal global error boundary with its own html and body", () => {
    expect(globalError).toContain('"use client"');
    expect(globalError).toContain("<html");
    expect(globalError).toContain("<body");
    expect(globalError).toContain("reset");
    expect(globalError).not.toContain("{error.message}");
  });

  it("has a custom 404 page", () => {
    expect(notFound).toContain("Errore 404");
    expect(notFound).toContain("Pagina non trovata");
    expect(notFound).toContain('href="/"');
    expect(notFound).toContain('href="/cerca"');
  });

  it("does not expose server 5xx payload messages through fetchJson", () => {
    expect(fetchJson).toContain("res.status >= 500");

    expect(fetchJson).toContain(
      "Si è verificato un problema del servizio. Riprova tra qualche istante.",
    );

    expect(fetchJson).toContain(
      "serverMessage ?? `Request failed (${res.status})`",
    );
  });

  it("still preserves useful API messages for non-5xx responses", () => {
    expect(fetchJson).toContain("serverMessage");
    expect(fetchJson).toContain("res.status >= 500");
  });

  it("does not place Supabase callback errors directly in the URL", () => {
    expect(authCallback).not.toContain(
      'errorUrl.searchParams.set("message", error.message)',
    );

    expect(authCallback).toContain(
      "Non è stato possibile completare l’accesso. Riprova.",
    );

    expect(authCallback).toContain("[auth-callback] Session exchange failed");
  });
});
