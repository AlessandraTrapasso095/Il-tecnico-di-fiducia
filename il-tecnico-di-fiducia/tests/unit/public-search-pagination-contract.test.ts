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

describe("public search pagination contract", () => {
  it("uses page size only as pagination, not as a total-result cap", () => {
    expect(source).toContain("const PUBLIC_SEARCH_PAGE_SIZE = 24;");
    expect(source).toContain(
      'const rawPage = Number(searchParams.get("page") ?? "1");',
    );
    expect(source).toContain('params.set("page", String(page));');
    expect(source).toContain(
      'params.set("page_size", String(PUBLIC_SEARCH_PAGE_SIZE));',
    );
  });

  it("calculates every available result page from the API total", () => {
    expect(source).toContain(
      "Math.ceil(total / PUBLIC_SEARCH_PAGE_SIZE)",
    );
    expect(source).toContain("Pagina {page} di {totalPages}");
  });

  it("navigates through pagination using the URL", () => {
    expect(source).toContain("function goToPage(nextPage: number)");
    expect(source).toContain('params.set("page", String(safePage));');
    expect(source).toContain('params.delete("page");');
    expect(source).toContain(
      'router.push(query ? `/cerca?${query}` : "/cerca");',
    );
    expect(source).toContain("onClick={() => goToPage(page - 1)}");
    expect(source).toContain("onClick={() => goToPage(page + 1)}");
  });

  it("does not rely on page state or render-time refs", () => {
    expect(source).not.toContain("setPage(");
    expect(source).not.toContain("previousApiQueryRef");
    expect(source).not.toContain("queryChanged");
    expect(source).not.toContain("effectivePage");
  });
});
