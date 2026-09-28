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

describe("public professional result card", () => {
  it("uses the same wide premium layout as customer search", () => {
    expect(source).toContain("data-professional-result-card");
    expect(source).toContain("md:grid-cols-[116px_minmax(0,1fr)_260px]");
    expect(source).toContain("lg:grid-cols-[128px_minmax(0,1fr)_310px]");
    expect(source).not.toContain(
      "grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3",
    );
  });

  it("uses the short professional presentation instead of the bio", () => {
    expect(source).toContain("search_summary: string | null");
    expect(source).toContain("professionalCardSummary");
    expect(source).toContain(
      "Questo professionista non ha ancora inserito la sua presentazione.",
    );
    expect(source).toContain("summary.slice(0, 137)");
    expect(source).toContain('{expanded ? "Chiudi" : "Altro"}');
  });

  it("renders portfolio media with carousel behavior", () => {
    expect(source).toContain("ProfessionalResultMediaCarousel");
    expect(source).toContain("work_media?: ProfessionalCardMedia[]");
    expect(source).toContain("window.setInterval");
    expect(source).toContain("2500");
    expect(source).toContain("Math.abs(delta) < 40");
    expect(source).toContain("media-swap-fade");
    expect(source).toContain('aria-label="Lavoro precedente"');
    expect(source).toContain('aria-label="Lavoro successivo"');
  });

  it("keeps mobile media first and mobile avatar visible", () => {
    expect(source).toContain("order-1 md:order-3");
    expect(source).toContain("md:hidden");
    expect(source).toContain('size="lg"');
    expect(source).toContain("aspect-[16/10]");
  });

  it("keeps guest contact behind login with resume intent", () => {
    expect(source).toContain(
      "const contactPath = `${profilePath}?action=contact`;",
    );
    expect(source).toContain(
      "const loginPath = `/auth/login?next=${encodeURIComponent(",
    );
    expect(source).toContain("href={profilePath}");
    expect(source).toContain("setAuthPrompt({");
    expect(source).toContain("loginHref: loginPath");
    expect(source).toContain("registerHref: registerPath");
    expect(source).not.toContain("href={loginPath}");
  });

  it("shows explicit loading feedback and skeletons", () => {
    expect(source).toContain("aria-busy={loading}");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("progress_activity");
    expect(source).toContain("animate-spin");
    expect(source).toContain("Ricerca in corso…");
  });
});
