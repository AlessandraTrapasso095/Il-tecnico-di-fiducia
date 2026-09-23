import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("contact resume flow contract", () => {
  it("preserves the contact intent from public result cards", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "src/components/public-search/public-professionals-search.tsx",
      ),
      "utf8",
    );

    expect(source).toContain(
      "const contactPath = `${profilePath}?action=contact`;",
    );
    expect(source).toContain(
      "const loginPath = `/auth/login?next=${encodeURIComponent(contactPath)}`;",
    );
  });

  it("preserves the contact intent from the public profile", () => {
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
  });
});
