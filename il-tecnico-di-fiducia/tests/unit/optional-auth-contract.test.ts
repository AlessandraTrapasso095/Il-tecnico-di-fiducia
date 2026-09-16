import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/lib/api/auth.ts"),
  "utf8",
);

describe("optional auth contract", () => {
  it("allows a missing session to remain anonymous", () => {
    expect(source).toContain('userError.name !== "AuthSessionMissingError"');
    expect(source).toContain("return { ok: true, ctx: null };");
  });

  it("does not silently downgrade inactive authenticated users to guests", () => {
    expect(source).toContain(
      'response: NextResponse.json({ error: "Forbidden" }, { status: 403 })',
    );
  });

  it("keeps the existing strict auth helper available", () => {
    expect(source).toContain("export async function requireAuth(");
    expect(source).toContain("export async function getOptionalAuth()");
  });
});
