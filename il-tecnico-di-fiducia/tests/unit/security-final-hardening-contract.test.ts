import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { safeAuthCallbackNextPath } from "@/lib/auth/callback-navigation";

const nextConfig = readFileSync("next.config.ts", "utf8");
const checkout = readFileSync(
  "src/app/api/profession-suggestions/checkout/route.ts",
  "utf8",
);

describe("security final hardening", () => {
  it("allows safe internal auth callback destinations", () => {
    expect(safeAuthCallbackNextPath("/auth/reset-password")).toBe(
      "/auth/reset-password",
    );

    expect(
      safeAuthCallbackNextPath(
        "/professionisti/pro-123?action=contact#profilo",
      ),
    ).toBe("/professionisti/pro-123?action=contact#profilo");
  });

  it("rejects external and backslash-based auth callback redirects", () => {
    expect(safeAuthCallbackNextPath("https://evil.example")).toBe("/");
    expect(safeAuthCallbackNextPath("//evil.example/path")).toBe("/");
    expect(safeAuthCallbackNextPath("/\\evil.example")).toBe("/");
    expect(safeAuthCallbackNextPath("\\\\evil.example\\path")).toBe("/");
  });

  it("defines baseline global security headers", () => {
    expect(nextConfig).toContain('"X-Content-Type-Options"');
    expect(nextConfig).toContain('"nosniff"');
    expect(nextConfig).toContain('"X-Frame-Options"');
    expect(nextConfig).toContain('"SAMEORIGIN"');
    expect(nextConfig).toContain('"Referrer-Policy"');
    expect(nextConfig).toContain('"Permissions-Policy"');
    expect(nextConfig).toContain('"Strict-Transport-Security"');
  });

  it("applies the security headers globally", () => {
    expect(nextConfig).toContain('source: "/:path*"');
    expect(nextConfig).toContain("headers: GLOBAL_SECURITY_HEADERS");
  });

  it("does not expose Stripe environment names in checkout user messages", () => {
    expect(checkout).not.toContain(
      "Pagamento temporaneamente non configurato: manca STRIPE_SECRET_KEY",
    );

    expect(checkout).not.toContain(
      "Pagamento temporaneamente non configurato: manca STRIPE_PROFESSION_SUGGESTION_PRICE_ID",
    );

    expect(checkout).toContain(
      "Pagamento temporaneamente non disponibile. Riprova più tardi.",
    );
  });
});
