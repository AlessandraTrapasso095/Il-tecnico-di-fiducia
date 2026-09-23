import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const login = read("src/app/admin/login/admin-login-client.tsx");
const management = read("src/app/admin/admin/admin-management-client.tsx");
const settings = read("src/app/admin/impostazioni/settings-client.tsx");
const discounts = read("src/app/admin/scontistiche/discount-codes-client.tsx");
const categories = read("src/components/admin/admin-categories-client.tsx");

const users = read("src/components/admin/admin-users-client.tsx");

describe("admin async button loading UX", () => {
  it("uses spinner + Caricamento on admin login and creation", () => {
    expect(login).toContain("progress_activity");
    expect(login).toContain("Caricamento…");
    expect(management).toContain("progress_activity");
    expect(management).toContain("Caricamento…");
  });

  it("keeps settings loading scoped to the clicked action", () => {
    expect(settings).toContain("loadingAction");
    expect(settings).toContain('loadingAction === "profile"');
    expect(settings).toContain('loadingAction === "notifications"');
    expect(settings).toContain("passwordLoading");
    expect(settings).toContain("progress_activity");
    expect(settings).toContain("Caricamento…");
  });

  it("handles create, reload and row update independently in discounts", () => {
    expect(discounts).toContain("manualReloading");
    expect(discounts).toContain("busyId === discount.id");
    expect(discounts).toContain("progress_activity");
    expect(discounts).toContain("Caricamento…");
  });

  it("tracks the specific category or subcategory action", () => {
    expect(categories).toContain("savingAction");
    expect(categories).toContain("loadingContent");
    expect(categories).toContain("category-create");
    expect(categories).toContain("category-toggle:");
    expect(categories).toContain("category-delete:");
    expect(categories).toContain("category-move:");
    expect(categories).toContain("subcategory-create:");
    expect(categories).toContain("subcategory-toggle:");
    expect(categories).toContain("subcategory-delete:");
    expect(categories).toContain("subcategory-move:");
    expect(categories).toContain("progress_activity");
    expect(categories).toContain("Caricamento…");
  });
  it("tracks the specific admin user action instead of only the user", () => {
    expect(users).toContain("busyAction");
    expect(users).toContain("loadingContent");
    expect(users).toContain("progress_activity");
    expect(users).toContain("Caricamento…");
    expect(users).toContain("reactivate:");
    expect(users).toContain("suspend:");
    expect(users).toContain("`suspend:${user.id}:${choice}`");
    expect(users).toContain("durationLabel(choice)");
    expect(users).toContain("password-reset:");
    expect(users).toContain("resend-confirmation:");
    expect(users).toContain("force-password-change:");
    expect(users).toContain("subscription:");
    expect(users).toContain('"Invia reset password"');
    expect(users).toContain('"Invia conferma email"');
    expect(users).toContain('"Forza cambio password"');
    expect(users).toContain("`subscription:${user.id}:${choice}`");
    expect(users).not.toContain("Operazione in corso…");
  });
});
