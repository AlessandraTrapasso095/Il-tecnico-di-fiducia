import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const profileComponent = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

const editModal = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/owner-profile-edit-modal.tsx",
  ),
  "utf8",
);

const api = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/professionals/[id]/route.ts"),
  "utf8",
);

describe("unified owner profile editing", () => {
  it("shows the edit UI only through owner context", () => {
    expect(profileComponent).toContain("viewerContext?.isOwner");

    expect(profileComponent).toContain('aria-label="Modifica il tuo profilo"');

    expect(profileComponent).toContain("<OwnerProfileEditModal");
  });

  it("uses the existing professional PATCH API", () => {
    expect(editModal).toContain("`/api/professionals/${profile.id}`");

    expect(editModal).toContain('method: "PATCH"');

    expect(api).toContain("export async function PATCH");
  });

  it("preserves existing editable data", () => {
    for (const field of [
      "first_name",
      "last_name",
      "bio",
      "province_code",
      "phone",
      "public_email",
      "website_url",
      "services_offered",
      "operational_provinces",
      "education",
      "work_experiences",
      "certifications",
      "available_remote",
      "available_travel",
      "is_ctu",
      "is_ctp",
    ]) {
      expect(editModal).toContain(field);
    }
  });

  it("gets private contacts from owner context", () => {
    expect(editModal).toContain("contacts?.phone");

    expect(editModal).toContain("contacts?.email");

    expect(editModal).toContain("contacts?.websiteUrl");
  });

  it("normalizes multiline fields", () => {
    expect(editModal).toContain("lines(draft.services_offered)");

    expect(editModal).toContain("draft.operational_provinces");

    expect(editModal).toContain("lines(draft.education)");

    expect(editModal).toContain("draft.work_experiences");

    expect(editModal).toContain("draft.certifications");
  });

  it("reloads server-derived data after save", () => {
    expect(editModal).toContain("window.location.reload()");
  });
});
