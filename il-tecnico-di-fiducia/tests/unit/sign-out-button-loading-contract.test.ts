import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const signOutButton = fs.readFileSync(
  path.join(process.cwd(), "src/components/auth/sign-out-button.tsx"),
  "utf8",
);

const customerShell = fs.readFileSync(
  path.join(process.cwd(), "src/components/customer/customer-area-shell.tsx"),
  "utf8",
);

const customerDashboard = fs.readFileSync(
  path.join(process.cwd(), "src/app/customer/customer-dashboard-client.tsx"),
  "utf8",
);

describe("sign out loading UX", () => {
  it("keeps the standard async-button loading content", () => {
    expect(signOutButton).toContain('loadingPresentation = "inline"');
    expect(signOutButton).toContain("progress_activity");
    expect(signOutButton).toContain("Caricamento…");
    expect(signOutButton).toContain("aria-busy={loading}");
  });

  it("supports a compact loading state with spinner only", () => {
    expect(signOutButton).toContain(
      'loadingPresentation?: "inline" | "compact"',
    );
    expect(signOutButton).toContain('loadingPresentation === "compact"');
    expect(signOutButton).toContain("progress_activity");
  });

  it("uses compact loading for the customer shell logout", () => {
    expect(customerShell).toContain('loadingPresentation="compact"');
    expect(customerShell).toContain("disabled:cursor-wait disabled:opacity-80");
  });

  it("uses compact loading for the customer dashboard logout", () => {
    expect(customerDashboard).toContain('loadingPresentation="compact"');
    expect(customerDashboard).toContain(
      "disabled:cursor-wait disabled:opacity-80",
    );
  });
});
