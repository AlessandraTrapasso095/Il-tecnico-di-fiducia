import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-search/public-professionals-search.tsx",
  ),
  "utf8",
);

describe("public search result filters", () => {
  it("keeps the filter panel compact and expandable", () => {
    expect(source).toContain("const [filtersOpen, setFiltersOpen]");
    expect(source).toContain("aria-expanded={filtersOpen}");
    expect(source).toContain('aria-controls="public-search-filters-panel"');
    expect(source).toContain("setFiltersOpen((current) => !current)");
    expect(source).toContain("activeFiltersCount");
    expect(source).toContain("expand_more");
    expect(source).toContain("grid-rows-[0fr]");
    expect(source).toContain("grid-rows-[1fr]");
  });

  it("keeps editable search filters on the results page", () => {
    expect(source).toContain("function PublicSearchFilters");
    expect(source).toContain("Filtri");
    expect(source).toContain("Macro-categoria");
    expect(source).toContain("Sottocategoria");
    expect(source).toContain("Provincia");
    expect(source).toContain("Da remoto");
    expect(source).toContain("Trasferte");
    expect(source).toContain("CTU");
    expect(source).toContain("CTP");
  });

  it("hydrates the controls from the current URL filters", () => {
    expect(source).toContain('initialParams.get("q")');
    expect(source).toContain('initialParams.get("category_id")');
    expect(source).toContain('initialParams.get("subcategory_id")');
    expect(source).toContain('initialParams.get("province_code")');
    expect(source).toContain('initialParams.get("remote") === "true"');
    expect(source).toContain('initialParams.get("travel") === "true"');
    expect(source).toContain('initialParams.get("is_ctu") === "true"');
    expect(source).toContain('initialParams.get("is_ctp") === "true"');
  });

  it("updates /cerca directly without returning to the homepage", () => {
    expect(source).toContain(
      'const nextPath = query ? `/cerca?${query}` : "/cerca";',
    );
    expect(source).toContain("onNavigate(nextPath)");
    expect(source).toContain("Azzera filtri");
    expect(source).toContain("Caricamento…");
  });

  it("does not leave loading stuck when the requested filters are already active", () => {
    expect(source).toContain('currentParams.delete("page")');
    expect(source).toContain("if (nextPath === currentPath)");
    expect(source).toContain("setSubmitting(false)");
  });

  it("loads category and subcategory options from the real API", () => {
    expect(source).toContain('fetchJson<CategoriesResponse>("/api/categories"');
    expect(source).toContain("currentSubcategories");
  });
});
