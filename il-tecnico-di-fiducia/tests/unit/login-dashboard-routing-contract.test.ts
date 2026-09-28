import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const loginClient = fs.readFileSync(
  path.join(process.cwd(), "src/app/auth/login/login-client.tsx"),
  "utf8",
);

const loginPage = fs.readFileSync(
  path.join(process.cwd(), "src/app/auth/login/page.tsx"),
  "utf8",
);

const rolePaths = fs.readFileSync(
  path.join(process.cwd(), "src/lib/routes/role-paths.ts"),
  "utf8",
);

describe("login dashboard routing", () => {
  it("uses the canonical role dashboard when no valid resume path exists", () => {
    expect(loginClient).toContain(
      "resumedPath ?? nextPathByRole(res.profile.role)",
    );
  });

  it("accepts an explicit next path from the login page", () => {
    expect(loginPage).toContain(
      'const nextPath = typeof sp.next === "string" ? sp.next : null;',
    );
    expect(loginPage).toContain("nextPath={nextPath}");
    expect(loginClient).toContain("nextPath?: string | null;");
    expect(loginClient).toContain(
      "safeNextPathForRole(nextPath, res.profile.role)",
    );
  });

  it("keeps the canonical role dashboards", () => {
    expect(rolePaths).toContain('if (role === "admin") return "/admin"');
    expect(rolePaths).toContain(
      'if (role === "professional") return "/professionista"',
    );
    expect(rolePaths).toContain('return "/customer"');
  });

  it("preserves forced admin password change before any resume path", () => {
    const forcedChange = loginClient.indexOf(
      'navigateAfterLogin("/auth/change-password")',
    );
    const resume = loginClient.indexOf(
      "safeNextPathForRole(nextPath, res.profile.role)",
    );

    expect(forcedChange).toBeGreaterThan(-1);
    expect(resume).toBeGreaterThan(forcedChange);
  });

  it("does not expose a fake remember-me control", () => {
    expect(loginClient).not.toContain("Ricordami su questo dispositivo");
    expect(loginClient).not.toContain("setRemember");
  });

  it("links the login footer to real public pages", () => {
    expect(loginClient).toContain('href="/faq"');
    expect(loginClient).toContain('href="/privacy"');
    expect(loginClient).toContain('href="/termini-di-servizio"');
  });
});
