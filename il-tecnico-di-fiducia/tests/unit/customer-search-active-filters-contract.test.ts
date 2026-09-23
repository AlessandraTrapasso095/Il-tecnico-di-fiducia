import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/customer/customer-dashboard-client.tsx"),
  "utf8",
);

describe("customer search active filters UX", () => {
  it("shows the result heading and a grammatically correct result count", () => {
    expect(source).toContain("Professionisti trovati");
    expect(source).toContain("1 professionista disponibile");
    expect(source).toContain("professionisti disponibili");
  });

  it("shows active filters outside the filter panel", () => {
    expect(source).toContain('aria-label="Filtri di ricerca attivi"');
    expect(source).toContain("Ricerca:");
    expect(source).toContain("Categoria:");
    expect(source).toContain("Sottocategoria:");
    expect(source).toContain("Provincia:");
    expect(source).toContain("Remoto");
    expect(source).toContain("Trasferte");
  });

  it("allows each active filter to be removed individually", () => {
    expect(source).toContain('onClick={() => setQ("")}');
    expect(source).toContain('onClick={() => updateCategory("")}');
    expect(source).toContain('onClick={() => setSubcategoryKey("")}');
    expect(source).toContain('onClick={() => setProvinceCode("")}');
    expect(source).toContain("onClick={() => setRemote(false)}");
    expect(source).toContain("onClick={() => setTravel(false)}");
  });

  it("keeps a one-click reset for the complete search state", () => {
    expect(source).toContain("onClick={resetFilters}");
    expect(source).toContain("Azzera filtri");
  });

  it("keeps the active-filter area responsive", () => {
    expect(source).toContain('className="mt-5 flex flex-wrap gap-2 md:mt-3"');
    expect(source).toContain("sm:w-auto");
  });
});
