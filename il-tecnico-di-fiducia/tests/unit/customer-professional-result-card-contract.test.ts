import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/customer/customer-dashboard-client.tsx"),
  "utf8",
);

describe("customer professional result card", () => {
  it("uses one wide premium result card", () => {
    expect(source).toContain("data-professional-result-card");
    expect(source).toContain("md:grid-cols-[92px_minmax(0,1fr)_260px]");
    expect(source).toContain("lg:grid-cols-[108px_minmax(0,1fr)_310px]");
  });

  it("keeps profile and contact actions side by side", () => {
    expect(source).toContain("Vedi profilo");
    expect(source).toContain("Contatta");
    expect(source).toContain("onClick={() => openContact(p)}");
    expect(source).toContain("flex gap-3");
    expect(source).toContain("bg-primary");
    expect(source).toContain("bg-[#FF8500]");
  });

  it("keeps favorites accessible from the media area", () => {
    expect(source).toContain("ProfessionalResultMediaCarousel");
    expect(source).toContain("onToggleSaved");
    expect(source).toContain("Aggiungi ai preferiti");
    expect(source).toContain("Rimuovi dai preferiti");
  });

  it("keeps name profession reviews location and availability", () => {
    expect(source).toContain("fullName(p)");
    expect(source).toContain("professionalCategoryLabel(p)");
    expect(source).toContain("<RatingStars");
    expect(source).toContain("location_on");
    expect(source).toContain("Remoto");
    expect(source).toContain("Trasferte");
  });

  it("does not render specializations in the customer result card", () => {
    expect(source).not.toContain(">Specializzazioni<");
    expect(source).not.toContain("p.specializations.length - 3");
  });

  it("supports real mobile summary expansion", () => {
    expect(source).toContain("function professionalCardSummary");
    expect(source).toContain("summary.length > 140");
    expect(source).toContain(
      "Questo professionista non ha ancora inserito la sua presentazione.",
    );
    expect(source).toContain("summary.slice(0, 137)");
    expect(source).toContain('expanded ? "" : "line-clamp-3"');
    expect(source).not.toContain("hover:text-secondary md:hidden");
    expect(source).toContain("function professionalCardExpandedSummary");
    expect(source).toContain("function ProfessionalCardSummaryText");
    expect(source).toContain(
      "const displayedSummary = expanded ? expandedSummary : summary;",
    );
    expect(source).toContain("expandedSummary={expandedSummary}");
    expect(source).toContain("aria-expanded={expanded}");
    expect(source).toContain('{expanded ? "Chiudi" : "Altro"}');
  });

  it("keeps mobile media first and the mobile avatar visible", () => {
    expect(source).toContain("order-1 md:order-3");
    expect(source).toContain("md:hidden");
    expect(source).toContain('size="lg"');
    expect(source).toContain("aspect-[16/10]");
  });
});
