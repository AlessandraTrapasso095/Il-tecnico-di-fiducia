import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  path.join(process.cwd(), "src/app/auth/register/page.tsx"),
  "utf8",
);

const client = fs.readFileSync(
  path.join(process.cwd(), "src/app/auth/register/register-client.tsx"),
  "utf8",
);

const loginClient = fs.readFileSync(
  path.join(process.cwd(), "src/app/auth/login/login-client.tsx"),
  "utf8",
);

describe("registration resume flow", () => {
  it("passes next from the register route to the client", () => {
    expect(page).toContain(
      'const nextPath = typeof sp.next === "string" ? sp.next : null;',
    );
    expect(page).toContain("nextPath={nextPath}");
  });

  it("resumes a safe destination after OTP confirmation", () => {
    expect(client).toContain("nextPath?: string | null;");
    expect(client).toContain("safeNextPathForRole(");
    expect(client).toContain("resumedPath ?? nextPathByRole");
  });

  it("keeps next when switching between login and registration", () => {
    expect(client).toContain("const loginHref = nextPath");
    expect(client).toContain("href={loginHref}");
    expect(loginClient).toContain("const registerHref = nextPath");
    expect(loginClient).toContain("href={registerHref}");
  });
});
