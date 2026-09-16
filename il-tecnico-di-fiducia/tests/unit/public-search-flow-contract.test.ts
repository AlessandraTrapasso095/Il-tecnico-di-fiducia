import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("public search flow contract", () => {
  it("routes homepage searches directly to the public results page", () => {
    const source = fs.readFileSync(
      path.join(root, "src/components/site/profession-search-flow.tsx"),
      "utf8",
    );

    expect(source).toContain("function buildPublicSearchPath");
    expect(source).toContain("return `/cerca");
    expect(source).toContain("router.push(publicSearchPath);");
    expect(source).not.toContain(
      "router.push(`/auth/login?next=${encodeURIComponent(customerPath)}`)",
    );
  });

  it("provides a public results page backed by the professionals API", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "src/components/public-search/public-professionals-search.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("/api/professionals?");
    expect(source).toContain("Vedi profilo");
    expect(source).toContain("Contatta");
  });

  it("keeps contact authenticated while profile navigation stays public", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "src/components/public-search/public-professionals-search.tsx",
      ),
      "utf8",
    );

    expect(source).toContain(
      "const profilePath = `/professionisti/${professional.id}`;",
    );
    expect(source).toContain(
      "const contactPath = `${profilePath}?action=contact`;",
    );
    expect(source).toContain(
      "const loginPath = `/auth/login?next=${encodeURIComponent(contactPath)}`;",
    );
    expect(source).toContain("href={profilePath}");
    expect(source).toContain("href={loginPath}");
  });
});
