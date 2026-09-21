import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ownerPage = fs.readFileSync(
  path.join(process.cwd(), "src/app/professionista/profilo/page.tsx"),
  "utf8",
);

const publicRoute = fs.readFileSync(
  path.join(process.cwd(), "src/app/professionisti/[id]/page.tsx"),
  "utf8",
);


const professionalLayout = fs.readFileSync(
  path.join(process.cwd(), "src/app/professionista/layout.tsx"),
  "utf8",
);

const component = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("unified owner professional profile", () => {
  it("renders the unified profile on the owner route", () => {
    expect(ownerPage).toContain("loadUnifiedAuthenticatedProfessionalProfile");

    expect(ownerPage).toContain("<PublicProfessionalProfile");

    expect(ownerPage).toContain("viewerContext={unified.viewerContext}");

    expect(ownerPage).not.toContain("ProfessionalProfileClient");
  });

  it("keeps the professional shell in the layout without duplicating it on the owner page", () => {
    expect(professionalLayout).toContain("<ProfessionalShell");
    expect(professionalLayout).toContain("avatar_url");

    expect(ownerPage).not.toContain("<ProfessionalShell");
  });

  it("keeps review notification deep links useful", () => {
    expect(ownerPage).toContain("searchParams");

    expect(ownerPage).toContain('value === "reviews"');

    expect(ownerPage).toContain('return "reviews"');

    expect(ownerPage).toContain("initialTab=");
  });

  it("keeps the canonical owner redirect from the public id route", () => {
    expect(publicRoute).toContain('redirect("/professionista/profilo")');
  });

  it("supports an initial unified profile tab", () => {
    expect(component).toContain('initialTab = "profile"');

    expect(component).toContain("useState<TabId>(initialTab)");
  });

  it("uses the required unfollow wording", () => {
    expect(component).toContain('"Non seguire più"');

    expect(component).not.toContain('"Segui già"');
  });
});
