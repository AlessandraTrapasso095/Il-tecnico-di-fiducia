import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("public professional profile contract", () => {
  it("provides a public-safe profile loader", () => {
    const source = fs.readFileSync(
      path.join(root, "src/lib/server/professional-profile.ts"),
      "utf8",
    );

    expect(source).toContain(
      "export async function loadPublicProfessionalProfile(",
    );
    expect(source).toContain(
      "isProfessionalVisibleToCustomers(professionalId, service)",
    );

    const publicType = source.split(
      "export type PublicProfessionalProfileDetails",
    )[1];

    expect(publicType).toBeTruthy();
    expect(publicType).not.toContain("public_email:");
    expect(publicType).not.toContain("phone:");
    expect(publicType).not.toContain("email:");
  });

  it("renders the public route without forcing login", () => {
    const source = fs.readFileSync(
      path.join(root, "src/app/professionisti/[id]/page.tsx"),
      "utf8",
    );

    expect(source).toContain("if (!optionalUser)");
    expect(source).toContain("loadPublicProfessionalProfile(id)");
    expect(source).toContain("<PublicProfessionalProfile");
  });

  it("keeps contact as an authenticated action", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "src/components/public-profile/public-professional-profile.tsx",
      ),
      "utf8",
    );

    expect(source).toContain(
      "const contactPath = `${profilePath}?action=contact`;",
    );
    expect(source).toContain(
      "const contactLoginPath = `/auth/login?next=${encodeURIComponent(contactPath)}`;",
    );
    expect(source).toContain("href={contactLoginPath}");
  });
});
