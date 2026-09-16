import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/professionals/route.ts"),
  "utf8",
);

describe("public professionals API contract", () => {
  it("uses optional auth instead of requiring a session", () => {
    expect(source).toContain(
      'import { getOptionalAuth } from "@/lib/api/auth";',
    );
    expect(source).toContain("const auth = await getOptionalAuth();");
    expect(source).not.toContain("const auth = await requireAuth();");
  });

  it("treats guests and customers as public searches", () => {
    expect(source).toContain(
      'const isPublicSearch = !profile || profile.role === "customer";',
    );
    expect(source).toContain(
      "isPublicSearch\n      ? await loadCustomerVisibleProfessionalIds(undefined, dataClient)",
    );
  });

  it("uses the service client for public reads without exposing personalized state", () => {
    expect(source).toContain(
      "const dataClient = isPublicSearch\n      ? createServiceClient()\n      : viewer!.supabase;",
    );
    expect(source).toContain('const viewerRole = profile?.role ?? "guest";');
  });
});
