import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dashboard = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/professionista/professional-dashboard-client.tsx",
  ),
  "utf8",
);

const shell = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/professionista/professional-shell.tsx",
  ),
  "utf8",
);

describe("professional dashboard responsive contract", () => {
  it("keeps composer controls stacked until md", () => {
    expect(dashboard).toContain(
      "md:flex-row md:items-end md:justify-between",
    );
  });

  it("never allows the publish CTA to wrap", () => {
    expect(dashboard).toContain(
      'min-h-11 shrink-0 whitespace-nowrap rounded-full bg-[#FF8500]',
    );
  });

  it("makes subscription actions mobile friendly", () => {
    expect(dashboard).toContain(
      "w-full flex-col gap-3 sm:flex-row",
    );

    expect(dashboard).toContain(
      "w-full shrink-0 items-center justify-center whitespace-nowrap",
    );
  });

  it("uses a compact mobile professional header", () => {
    expect(shell).toContain(
      "top-0 z-50 h-16",
    );

    expect(shell).toContain(
      "gap-0.5 sm:gap-3",
    );
  });

  it("does not contain known malformed utility tokens", () => {
    expect(dashboard).not.toContain("bg-white/65px-4");
    expect(dashboard).not.toContain("border-2border-dashed");

    expect(shell).not.toContain("top-0z-50");
    expect(shell).not.toContain("items-centergap");
    expect(shell).not.toContain("rounded-2xlborder");
    expect(shell).not.toContain("flexflex-wrap");
    expect(shell).not.toContain("right-1top-1");
  });
});
