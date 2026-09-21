import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/lib/professions/taxonomy.ts"),
  "utf8",
);

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260916170000_prune_non_technical_professions.sql",
  ),
  "utf8",
);

const retainedSlugs = [
  "ingegneri",
  "architetti",
  "geometri",
  "periti-industriali",
  "geologi",
  "agronomi",
  "informatici",
  "interior-designer",
];

const removedSlugs = [
  "avvocati",
  "commercialisti",
  "consulenti-del-lavoro",
  "notai",
  "psicologi",
  "dietologi",
  "ctu-ctp",
];

describe("technical profession taxonomy contract", () => {
  it("keeps the intended technical profession categories in the catalog", () => {
    for (const slug of retainedSlugs) {
      expect(source).toContain(`slug: "${slug}"`);
    }
  });

  it("removes non-technical professions and CTU/CTP as categories", () => {
    const catalogSection = source
      .split("export const PROFESSION_CATEGORIES", 2)[1]
      .split("export function professionCategoryKey", 1)[0];

    for (const slug of removedSlugs) {
      expect(catalogSection).not.toContain(`slug: "${slug}"`);
    }
  });

  it("deactivates removed categories instead of deleting historical rows", () => {
    expect(migration).toContain("update public.categories");
    expect(migration).toContain("update public.subcategories");
    expect(migration).toContain("is_active = false");
    expect(migration).not.toContain("delete from public.categories");
    expect(migration).not.toContain("delete from public.subcategories");

    for (const slug of removedSlugs) {
      expect(migration).toContain(`'${slug}'`);
    }
  });

  it("keeps canonical engineering and IT taxonomy", () => {
    for (const label of [
      "Ingegneria civile e strutturale",
      "Ingegneria edile",
      "Ingegneria geotecnica",
      "Pratiche sismiche",
      "Full Stack Web Developer",
      "Front End Developer",
      "Back End Developer",
      "Cybersecurity e sicurezza informatica",
      "Cloud e DevOps",
      "Networking",
      "Consulenza IT",
      "Domotica e IoT",
      "Computer Vision",
      "Prompt Engineering",
    ]) {
      expect(source).toContain(`"${label}"`);
    }

    expect(source).not.toContain(
      `"Cybersecurity",
      "Sicurezza informatica"`,
    );
  });
});
