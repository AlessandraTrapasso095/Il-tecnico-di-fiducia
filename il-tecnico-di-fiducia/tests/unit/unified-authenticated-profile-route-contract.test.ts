import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  path.join(process.cwd(), "src/app/professionisti/[id]/page.tsx"),
  "utf8",
);

const bridge = fs.readFileSync(
  path.join(process.cwd(), "src/lib/server/unified-professional-profile.ts"),
  "utf8",
);

describe("unified authenticated professional profile route", () => {
  it("uses the unified profile for authenticated viewers", () => {
    expect(page).toContain("loadUnifiedAuthenticatedProfessionalProfile");

    expect(page).toContain("<PublicProfessionalProfile");

    expect(page).toContain("viewerContext=");

    expect(page).not.toContain("<ProfessionalProfileClient");
  });

  it("temporarily keeps the owner redirect until owner editing is migrated", () => {
    expect(page).toContain('redirect("/professionista/profilo")');
  });

  it("keeps the existing authenticated shells", () => {
    expect(page).toContain("<CustomerAreaShell>");

    expect(page).toContain("<AdminShell");

    expect(page).toContain("<ProfessionalShell");
  });

  it("keeps private contacts outside the public DTO", () => {
    expect(bridge).toContain("canViewContacts");

    expect(bridge).toContain("const contacts = canViewContacts");

    expect(bridge).toContain("public_email");

    expect(bridge).toContain("website_url");
  });

  it("does not unlock contacts through follow state", () => {
    const contactsStart = bridge.indexOf("const contacts = canViewContacts");

    const returnStart = bridge.indexOf("return {", contactsStart);

    expect(contactsStart).toBeGreaterThanOrEqual(0);

    expect(returnStart).toBeGreaterThan(contactsStart);

    const contactsBlock = bridge.slice(contactsStart, returnStart);

    expect(contactsBlock).not.toContain("isFollowing");
  });

  it("uses authenticated access for follow and contact permissions", () => {
    expect(bridge).toContain("authenticated.access.can_view_contacts");

    expect(bridge).toContain("authenticated.access.is_following");

    expect(bridge).toContain("latest_contact_request");
  });
});
