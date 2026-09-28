import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const logger = readFileSync("src/lib/server/api-logger.ts", "utf8");

const internalError = readFileSync(
  "src/lib/api/internal-server-error.ts",
  "utf8",
);

const proxy = readFileSync("src/proxy.ts", "utf8");

const health = readFileSync("src/app/api/health/route.ts", "utf8");

const discounts = readFileSync(
  "src/app/api/admin/subscription-discounts/route.ts",
  "utf8",
);

describe("monitoring foundation contract", () => {
  it("redacts secrets and masks email values in the server logger", () => {
    expect(logger).toContain("SENSITIVE_KEY_PATTERN");
    expect(logger).toContain("EMAIL_VALUE_PATTERN");
    expect(logger).toContain("[redacted]");
    expect(logger).not.toContain("raw: error");
  });

  it("adds a correlation id to internal server errors", () => {
    expect(internalError).toContain("randomUUID");
    expect(internalError).toContain("request_id: requestId");
    expect(internalError).toContain('"x-request-id": requestId');
    expect(internalError).toContain('"cache-control": "no-store"');
  });

  it("adds x-request-id to application responses", () => {
    expect(proxy).toContain("randomUUID");
    expect(proxy).toContain('"x-request-id"');
    expect(proxy).toContain('response.headers.set("x-request-id", id)');
  });

  it("provides an uncached health endpoint without secrets", () => {
    expect(health).toContain('status: "ok"');
    expect(health).toContain('service: "il-tecnico-di-fiducia"');
    expect(health).toContain('"cache-control": "no-store, max-age=0"');
    expect(health).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(health).not.toContain("STRIPE_SECRET_KEY");
  });

  it("does not log the full discount recipient email", () => {
    expect(discounts).not.toContain("recipient: recipient.email");

    expect(discounts).toContain("recipient_domain:");
  });
});
