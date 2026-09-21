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

  it("preserves all editable owner fields", () => {
    for (const field of [
      "first_name",
      "last_name",
      "headline",
      "specializations",
      "category_id",
      "subcategory_id",
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

  it("loads taxonomy with visible feedback", () => {
    expect(editModal).toContain('fetch("/api/categories"');
    expect(editModal).toContain("taxonomyCategories.map");
    expect(editModal).toContain("availableSubcategories");
    expect(editModal).toContain("Caricamento categorie…");
    expect(editModal).toContain("taxonomyError");
  });

  it("saves professional fields only when changed", () => {
    expect(editModal).toContain("draft.headline !== initialDraft.headline");
    expect(editModal).toContain("draft.specializations !==");
    expect(editModal).toContain("payload.headline");
    expect(editModal).toContain("payload.specializations");
    expect(editModal).toContain("payload.category_id");
    expect(editModal).toContain("payload.subcategory_id");
  });

  it("gets private contacts from owner context", () => {
    expect(editModal).toContain("contacts?.phone");
    expect(editModal).toContain("contacts?.email");
    expect(editModal).toContain("contacts?.websiteUrl");
  });

  it("normalizes multiline curriculum fields", () => {
    expect(editModal).toContain("function jsonFromLines(value: string)");
    expect(editModal).toContain(
      "payload.education = jsonFromLines(draft.education)",
    );
    expect(editModal).toContain(
      "payload.work_experiences = jsonFromLines(draft.work_experiences)",
    );
    expect(editModal).toContain(
      "payload.certifications = jsonFromLines(draft.certifications)",
    );
  });

  it("reloads server-derived data after save", () => {
    expect(editModal).toContain("window.location.reload()");
  });

  it("verifies database updates return the updated rows", () => {
    expect(api).toContain('.select("id")');
    expect(api).toContain("Il profilo personale non è stato aggiornato.");
    expect(api).toContain("Il profilo professionale non è stato aggiornato.");
  });
});
