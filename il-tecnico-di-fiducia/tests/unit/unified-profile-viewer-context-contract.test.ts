import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const component = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("unified professional profile viewer context", () => {
  it("supports guest, customer, professional and admin viewers", () => {
    expect(component).toContain('role: "customer" | "professional" | "admin"');

    expect(component).toContain(
      "viewerContext?: ProfessionalProfileViewerContext | null",
    );

    expect(component).toContain("viewerContext = null");
  });

  it("keeps guest contact behind the existing login flow", () => {
    expect(component).toContain("contactLoginPath");

    expect(component).toContain("?action=contact");

    expect(component).toContain("href={contactLoginPath}");
  });

  it("shows follow controls for a professional viewing another professional", () => {
    expect(component).toContain('viewerContext?.role === "professional"');

    expect(component).toContain("!viewerContext.isOwner");

    expect(component).toContain('"Non seguire più"');

    expect(component).toContain('"Segui"');

    expect(component).toContain('"person_check"');

    expect(component).toContain('"person_add"');
  });

  it("uses the existing follow and unfollow APIs", () => {
    expect(component).toContain("/api/follows/");

    expect(component).toContain("/api/follows");

    expect(component).toContain('method: "DELETE"');

    expect(component).toContain('method: "POST"');

    expect(component).toContain("followed_id: profile.id");
  });

  it("shows real contacts only when contact access is allowed", () => {
    expect(component).toContain("viewerContext?.canViewContacts");

    expect(component).toContain('aria-label="Dati di contatto visibili"');

    expect(component).toContain('aria-label="Dati di contatto oscurati"');

    expect(component).toContain("viewerContext.contacts.phone");

    expect(component).toContain("viewerContext.contacts.email");

    expect(component).toContain("viewerContext.contacts.websiteUrl");
  });

  it("does not use follow state to unlock private contacts", () => {
    const visibleContactsIndex = component.indexOf(
      'aria-label="Dati di contatto visibili"',
    );

    const specializationsIndex = component.indexOf(
      "Specializzazioni",
      visibleContactsIndex,
    );

    expect(visibleContactsIndex).toBeGreaterThanOrEqual(0);
    expect(specializationsIndex).toBeGreaterThan(visibleContactsIndex);

    const contactArea = component.slice(
      visibleContactsIndex,
      specializationsIndex,
    );

    expect(contactArea).toContain("viewerContext.contacts.phone");

    expect(contactArea).toContain("viewerContext.contacts.email");

    expect(contactArea).not.toContain("isFollowing");
  });
});
