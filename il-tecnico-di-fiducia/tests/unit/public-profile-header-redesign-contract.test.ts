import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("public professional profile header redesign", () => {
  it("does not restore the obsolete back-to-search control", () => {
    expect(source).not.toContain('href="/cerca"');
    expect(source).not.toContain("Torna alla ricerca");
  });

  it("uses the large professional avatar", () => {
    const avatarSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/components/public-profile/owner-editable-avatar.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("<OwnerEditableAvatar");

    expect(avatarSource).toContain('size="2xl"');

    expect(avatarSource).toContain("ProfileAvatar");
  });

  it("places identity and actions in a responsive header", () => {
    expect(source).toContain("md:flex-row md:items-start md:justify-between");

    expect(source).toContain(
      "flex shrink-0 flex-col gap-2 md:items-end md:pt-1",
    );
  });

  it("shows professional identity details", () => {
    expect(source).toContain("professionLabel");

    expect(source).toContain("fullName(profile)");

    expect(source).toContain("profile.headline");
  });

  it("keeps location and availability badges", () => {
    expect(source).toContain("location_on");

    expect(source).toContain("Remoto");

    expect(source).toContain("Trasferte");
  });

  it("supports viewer-specific header actions", () => {
    expect(source).toContain("contactLoginPath");

    expect(source).toContain('viewerContext?.role === "customer"');

    expect(source).toContain('viewerContext?.role === "professional"');

    expect(source).toContain('"Non seguire più"');

    expect(source).toContain('"Segui"');
  });
});
