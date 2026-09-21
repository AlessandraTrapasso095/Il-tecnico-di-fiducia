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

const serverProfile = fs.readFileSync(
  path.join(process.cwd(), "src/lib/server/professional-profile.ts"),
  "utf8",
);

describe("public profile contact lock contract", () => {
  it("places contact data after reviews and before specializations", () => {
    const sidebarIndex = component.indexOf('<aside className="space-y-9');

    const reviewsIndex = component.indexOf("Recensioni", sidebarIndex);

    const contactsIndex = component.indexOf("Dati di contatto", reviewsIndex);

    const specializationsIndex = component.indexOf(
      "Specializzazioni",
      contactsIndex,
    );

    expect(sidebarIndex).toBeGreaterThanOrEqual(0);
    expect(reviewsIndex).toBeGreaterThan(sidebarIndex);
    expect(contactsIndex).toBeGreaterThan(reviewsIndex);
    expect(specializationsIndex).toBeGreaterThan(contactsIndex);
  });

  it("supports both visible and masked contact states", () => {
    expect(component).toContain('aria-label="Dati di contatto visibili"');

    expect(component).toContain('aria-label="Dati di contatto oscurati"');

    expect(component).toContain("viewerContext?.canViewContacts");
  });

  it("renders phone email and website rows", () => {
    expect(component).toContain('"Telefono"');

    expect(component).toContain('"Email"');

    expect(component).toContain('"Sito web"');
  });

  it("keeps guest contact behind the login flow", () => {
    expect(component).toContain("contactLoginPath");

    expect(component).toContain("href={contactLoginPath}");

    expect(component).toContain("?action=contact");

    expect(component).toContain("Contatta per richiedere l&apos;accesso");
  });

  it("does not expose private contact fields in the public DTO", () => {
    const publicTypeStart = serverProfile.indexOf(
      "export type PublicProfessionalProfileDetails",
    );

    const publicLoaderStart = serverProfile.indexOf(
      "export async function loadPublicProfessionalProfile",
    );

    expect(publicTypeStart).toBeGreaterThanOrEqual(0);
    expect(publicLoaderStart).toBeGreaterThan(publicTypeStart);

    const publicType = serverProfile.slice(publicTypeStart, publicLoaderStart);

    expect(publicType).not.toContain("public_email:");

    expect(publicType).not.toContain("phone:");

    expect(publicType).not.toContain("email:");
  });
});
