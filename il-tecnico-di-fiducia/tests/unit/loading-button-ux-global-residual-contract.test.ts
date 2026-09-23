import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const publicProfile = read(
  "src/components/public-profile/public-professional-profile.tsx",
);
const messages = read("src/app/messages/messages-client.tsx");
const customer = read("src/app/customer/customer-dashboard-client.tsx");
const legacyProfessionalProfile = read(
  "src/components/professionals/professional-profile-client.tsx",
);
const register = read("src/app/auth/register/register-client.tsx");

describe("global async-button residual UX", () => {
  it("shows spinner + Caricamento while following", () => {
    expect(publicProfile).toContain("followBusy ? (");
    expect(publicProfile).toContain("progress_activity");
    expect(publicProfile).toContain("Caricamento…");
    expect(publicProfile).not.toContain(
      'followBusy\\n                    ? "Aggiornamento…"',
    );
  });

  it("cannot dismiss delete-chat modal through backdrop while deleting", () => {
    expect(messages).toContain(
      "if (!deletingChat) setConfirmDeleteOpen(false);",
    );
  });

  it("shows loading feedback inside customer retry buttons", () => {
    expect(customer).toContain("categoriesRetrying");
    expect(customer).toContain("professionalsRetrying");
    expect(customer).toContain("retryFilters");
    expect(customer).toContain("retryProfessionals");
    expect(customer).toContain("aria-busy={categoriesRetrying}");
    expect(customer).toContain("aria-busy={professionalsRetrying}");
    expect(customer).toContain("progress_activity");
    expect(customer).toContain("Caricamento…");
  });

  it("uses Caricamento instead of Ricerca on the async search button", () => {
    expect(customer).not.toContain("Ricerca…");
  });
  it("shows action-specific loading while accepting or rejecting a request", () => {
    expect(messages).toContain("requestDecisionBusy");
    expect(messages).toContain('requestDecisionBusy === "rejected"');
    expect(messages).toContain('requestDecisionBusy === "accepted"');
    expect(messages).toContain("setRequestDecisionBusy(status)");
    expect(messages).toContain("setRequestDecisionBusy(null)");
    expect(messages).toContain("progress_activity");
    expect(messages).toContain("Caricamento…");
  });

  it("shows spinner + Caricamento during cropped profile image upload", () => {
    expect(legacyProfessionalProfile).toContain("aria-busy={uploadingImage}");
    expect(legacyProfessionalProfile).toContain("progress_activity");
    expect(legacyProfessionalProfile).toContain("Caricamento…");
  });
  it("shows spinner + Caricamento for signup and OTP resend", () => {
    expect(register).not.toContain("Creazione…");
    expect(register).toContain("resendingOtp");
    expect(register).toContain("aria-busy={resendingOtp}");
    expect(register).toContain("progress_activity");
    expect(register).toContain("Caricamento…");
  });

  it("shows action-specific loading for adding and editing comments", () => {
    expect(legacyProfessionalProfile).toContain("addingComment");
    expect(legacyProfessionalProfile).toContain("updatingCommentId");
    expect(legacyProfessionalProfile).toContain("aria-busy={addingComment}");
    expect(legacyProfessionalProfile).toContain(
      "aria-busy={updatingCommentId === comment.id}",
    );
    expect(legacyProfessionalProfile).toContain("progress_activity");
    expect(legacyProfessionalProfile).toContain("Caricamento…");
  });

  it("keeps catalog retry feedback inside the clicked button", () => {
    expect(legacyProfessionalProfile).toContain("onClick={onReload}");
    expect(legacyProfessionalProfile).toContain("disabled={loading}");
    expect(legacyProfessionalProfile).toContain("aria-busy={loading}");
    expect(legacyProfessionalProfile).toContain("Riprova");
    expect(legacyProfessionalProfile).toContain("Caricamento…");
  });
});
