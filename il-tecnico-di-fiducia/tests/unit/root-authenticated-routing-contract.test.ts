import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootPage = fs.readFileSync(
  path.join(process.cwd(), "src/app/page.tsx"),
  "utf8",
);

describe("authenticated root routing", () => {
  it("keeps the public homepage for guests but checks an existing session", () => {
    expect(rootPage).toContain("await createClient()");
    expect(rootPage).toContain("supabase.auth.getUser()");
    expect(rootPage).toContain('supabase.rpc("is_active_user")');
    expect(rootPage).toContain("getPublicHomepageReviews()");
  });

  it("redirects an active authenticated account to its canonical role dashboard", () => {
    expect(rootPage).toContain(
      'import { nextPathByRole, type AppRole } from "@/lib/routes/role-paths"',
    );
    expect(rootPage).toContain(
      "nextPathByRole(rootAuthenticatedProfile.role as AppRole)",
    );
  });

  it("preserves the mandatory admin password-change flow", () => {
    expect(rootPage).toContain('rootAuthenticatedProfile.role === "admin"');
    expect(rootPage).toContain("rootAuthenticatedProfile.must_change_password");
    expect(rootPage).toContain('redirect("/auth/change-password")');
  });

  it("loads the public content only after the authenticated redirect check", () => {
    const authIndex = rootPage.indexOf("rootAuthenticatedProfile");
    const reviewsIndex = rootPage.indexOf("getPublicHomepageReviews()");

    expect(authIndex).toBeGreaterThan(-1);
    expect(reviewsIndex).toBeGreaterThan(authIndex);
  });
});
