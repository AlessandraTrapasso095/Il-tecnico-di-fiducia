import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const account = read("src/components/account/account-settings-client.tsx");
const checkout = read("src/components/billing/start-checkout-button.tsx");
const portal = read("src/components/billing/start-portal-button.tsx");
const logout = read("src/components/auth/sign-out-button.tsx");
const customer = read("src/app/customer/customer-dashboard-client.tsx");
const profile = read(
  "src/components/public-profile/public-professional-profile.tsx",
);
const ownerEdit = read(
  "src/components/public-profile/owner-profile-edit-modal.tsx",
);
const forgotPassword = read("src/app/auth/forgot-password/page.tsx");
const changePassword = read("src/app/auth/change-password/page.tsx");

describe("core async button loading UX", () => {
  it("uses the shared visual loading pattern", () => {
    for (const source of [
      account,
      checkout,
      portal,
      logout,
      customer,
      profile,
      ownerEdit,
      forgotPassword,
      changePassword,
    ]) {
      expect(source).toContain("progress_activity");
      expect(source).toContain("animate-spin");
      expect(source).toContain("Caricamento…");
    }
  });

  it("keeps async buttons disabled while their operation is busy", () => {
    expect(account).toContain("disabled={saving}");
    expect(account).toContain("disabled={passwordSaving}");
    expect(checkout).toContain("disabled={loading}");
    expect(portal).toContain("disabled={loading}");
    expect(logout).toContain("disabled={loading}");
    expect(customer).toContain("disabled={contactSending}");
    expect(profile).toContain("disabled={followBusy}");
    expect(profile).toContain("disabled={busyLikePostId === post.id}");
    expect(ownerEdit).toContain("saving || !draft.first_name.trim()");
  });

  it("shows loading even when the logout button receives custom children", () => {
    expect(logout).toContain("loading ? (");
    expect(logout).toContain('children ?? "Esci"');
  });
});
