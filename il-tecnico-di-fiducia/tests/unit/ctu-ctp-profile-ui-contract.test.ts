import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const profileClient = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/professionals/professional-profile-client.tsx",
  ),
  "utf8",
);

describe("CTU / CTP professional profile UI contract", () => {
  it("loads CTU and CTP values into the profile edit draft", () => {
    expect(profileClient).toContain("is_ctu: profile.is_ctu");
    expect(profileClient).toContain("is_ctp: profile.is_ctp");
  });

  it("submits CTU and CTP independently", () => {
    expect(profileClient).toContain(
      "payload.is_ctu = Boolean(editDraft.is_ctu)",
    );
    expect(profileClient).toContain(
      "payload.is_ctp = Boolean(editDraft.is_ctp)",
    );
  });

  it("keeps local profile state aligned after save", () => {
    expect(profileClient).toContain(
      'typeof payload.is_ctu === "boolean"',
    );
    expect(profileClient).toContain(
      'typeof payload.is_ctp === "boolean"',
    );
  });

  it("provides independent CTU and CTP controls", () => {
    expect(profileClient).toContain('checked={Boolean(draft.is_ctu)}');
    expect(profileClient).toContain('checked={Boolean(draft.is_ctp)}');
    expect(profileClient).toContain(
      "CTU — Consulente Tecnico d&apos;Ufficio",
    );
    expect(profileClient).toContain(
      "CTP — Consulente Tecnico di Parte",
    );
  });

  it("shows qualification badges only when enabled", () => {
    expect(profileClient).toContain("profile.is_ctu || profile.is_ctp");
    expect(profileClient).toContain("profile.is_ctu ?");
    expect(profileClient).toContain("profile.is_ctp ?");
  });
});
