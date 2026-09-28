import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const authLayout = readFileSync("src/app/auth/layout.tsx", "utf8");
const adminLogin = readFileSync(
  "src/app/admin/login/admin-login-client.tsx",
  "utf8",
);
const topNav = readFileSync("src/components/site/top-nav.tsx", "utf8");
const professionalShell = readFileSync(
  "src/app/professionista/professional-shell.tsx",
  "utf8",
);
const customerShell = readFileSync(
  "src/components/customer/customer-area-shell.tsx",
  "utf8",
);
const customerDashboard = readFileSync(
  "src/app/customer/customer-dashboard-client.tsx",
  "utf8",
);

describe("final responsive QA fixes", () => {
  it("uses the official logo in auth instead of the check mark", () => {
    expect(authLayout).toContain('src="/img/logo-mark.png"');
    expect(authLayout).not.toContain(">✓</span>");
  });

  it("uses the official logo in admin login instead of the admin icon", () => {
    expect(adminLogin).toContain('src="/img/logo-mark.png"');
    expect(adminLogin).not.toContain("admin_panel_settings");
  });

  it("keeps the public and professional wordmarks visible on mobile", () => {
    expect(topNav).not.toContain(
      'className="hidden min-w-0 flex-col leading-none sm:flex"',
    );
    expect(professionalShell).not.toContain(
      'className="hidden flex-col leading-none sm:flex"',
    );
  });

  it("keeps the customer wordmark visible on mobile with brand colors", () => {
    expect(customerShell).not.toContain("min-[430px]:block");
    expect(customerShell).toContain("text-primary");
    expect(customerShell).toContain("text-[#FF8500]");
  });

  it("keeps the real customer dashboard brand visible on mobile", () => {
    expect(customerDashboard).not.toContain("min-[430px]:block");
    expect(customerDashboard).toContain("text-primary");
    expect(customerDashboard).toContain("text-[#FF8500]");
  });

  it("keeps customer search and requests synchronized in the real dashboard", () => {
    expect(customerDashboard).toContain("function goToExplore()");
    expect(customerDashboard).toContain("function goToRequests()");
    expect(customerDashboard).toContain("function scrollCustomerTo");
    expect(customerDashboard).toContain("window.scrollTo");
    expect(customerDashboard).toContain('getElementById("richieste")');
    expect(customerDashboard).toContain('homeSection === "search"');
    expect(customerDashboard).toContain('homeSection === "requests"');
    expect(customerDashboard).not.toContain(
      "className={customerNavTextClass(false)}",
    );
  });
});
