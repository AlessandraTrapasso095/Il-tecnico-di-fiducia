import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/customer/customer-dashboard-client.tsx"),
  "utf8",
);

describe("customer favorites menu", () => {
  it("shows the number of saved professionals on the header heart", () => {
    expect(source).toContain("savedIds.size > 0");
    expect(source).toContain('{savedIds.size > 99 ? "99+" : savedIds.size}');
    expect(source).toContain("preferiti salvati");
  });

  it("keeps profile navigation separate from favorite removal", () => {
    expect(source).toContain(
      'className="flex min-w-0 flex-1 gap-3 rounded-xl p-1"',
    );
    expect(source).toContain('title="Rimuovi dai preferiti"');
    expect(source).toContain("onClick={() => void toggleSaved(professional)}");
  });

  it("gives the remove action an accessible professional-specific label", () => {
    expect(source).toContain(
      "aria-label={`Rimuovi ${fullName(professional)} dai preferiti`}",
    );
  });
});
