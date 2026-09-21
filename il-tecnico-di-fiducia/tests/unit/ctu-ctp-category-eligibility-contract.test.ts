import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const taxonomyServer = fs.readFileSync(
  path.join(process.cwd(), "src/lib/server/professional-taxonomy.ts"),
  "utf8",
);

const ownerModal = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/owner-profile-edit-modal.tsx",
  ),
  "utf8",
);

describe("CTU / CTP category eligibility", () => {
  it("allows qualifications only for intended technical categories", () => {
    for (const slug of [
      "ingegneri",
      "architetti",
      "geometri",
      "periti-industriali",
      "geologi",
      "agronomi",
      "informatici",
    ]) {
      expect(taxonomyServer).toContain(`"${slug}"`);
    }

    expect(taxonomyServer).not.toContain('"interior-designer",');
  });

  it("shares an explicit server eligibility helper", () => {
    expect(taxonomyServer).toContain("professionalCategoryAllowsCtuCtp");
    expect(taxonomyServer).toContain("CTU_CTP_CATEGORY_SLUGS");
  });

  it("hides and resets CTU / CTP for Interior designer in owner editor", () => {
    expect(ownerModal).toContain(
      'qualificationCategorySlug !== "interior-designer"',
    );
    expect(ownerModal).toContain("supportsCtuCtp");
    expect(ownerModal).toContain('nextCategory?.slug !== "interior-designer"');
    expect(ownerModal).toContain("is_ctu: keepsQualifications");
    expect(ownerModal).toContain("is_ctp: keepsQualifications");
  });

  it("enforces CTU / CTP eligibility on the PATCH API", () => {
    const detailApi = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/professionals/[id]/route.ts"),
      "utf8",
    );

    expect(detailApi).toContain("professionalCategoryAllowsCtuCtp");
    expect(detailApi).toContain("effectiveQualificationCategorySlugs");
    expect(detailApi).toContain("professionalUpdates.is_ctu = false");
    expect(detailApi).toContain("professionalUpdates.is_ctp = false");
    expect(detailApi).toContain('.from("professional_categories")');
    expect(detailApi).toContain("currentQualificationCategories");
  });
});
