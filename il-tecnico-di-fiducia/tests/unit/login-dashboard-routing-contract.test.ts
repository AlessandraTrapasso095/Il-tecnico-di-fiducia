import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const loginClient = fs.readFileSync(
  path.join(process.cwd(), "src/app/auth/login/login-client.tsx"),
  "utf8",
);

const rolePaths = fs.readFileSync(
  path.join(process.cwd(), "src/lib/routes/role-paths.ts"),
  "utf8",
);

describe("login dashboard routing", () => {
  it("always sends a successful login to the dashboard for the account role", () => {
    expect(loginClient).toContain(
      "navigateAfterLogin(nextPathByRole(res.profile.role))",
    );

    expect(loginClient).not.toContain("safeNextPath");
    expect(loginClient).not.toContain("routeBelongsToRole");
    expect(loginClient).not.toContain("nextPath?:");
    expect(loginClient).not.toContain("nextPath,");
  });

  it("keeps the canonical role dashboards", () => {
    expect(rolePaths).toContain('if (role === "admin") return "/admin"');
    expect(rolePaths).toContain(
      'if (role === "professional") return "/professionista"',
    );
    expect(rolePaths).toContain('return "/customer"');
  });

  it("preserves forced admin password change before dashboard", () => {
    expect(loginClient).toContain(
      'navigateAfterLogin("/auth/change-password")',
    );
  });
});
