import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260916173000_professional_ctu_ctp_qualifications.sql",
  ),
  "utf8",
);

const profileLoader = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/lib/server/professional-profile.ts",
  ),
  "utf8",
);

const directoryApi = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/api/professionals/route.ts",
  ),
  "utf8",
);

const detailApi = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/api/professionals/[id]/route.ts",
  ),
  "utf8",
);

describe("CTU / CTP qualification contract", () => {
  it("stores CTU and CTP independently on profile and directory", () => {
    expect(migration).toContain(
      "add column if not exists is_ctu boolean not null default false",
    );
    expect(migration).toContain(
      "add column if not exists is_ctp boolean not null default false",
    );
    expect(migration).toContain("public.professional_profiles");
    expect(migration).toContain("public.professional_directory");
  });

  it("syncs qualifications from professional profile to directory", () => {
    expect(migration).toContain("is_ctu = excluded.is_ctu");
    expect(migration).toContain("is_ctp = excluded.is_ctp");
    expect(migration).toContain("is_ctu,");
    expect(migration).toContain("is_ctp");
  });

  it("exposes qualifications through authenticated and public profile DTOs", () => {
    expect(profileLoader).toContain("is_ctu: boolean");
    expect(profileLoader).toContain("is_ctp: boolean");
    expect(profileLoader).toContain("Boolean(professional.is_ctu)");
    expect(profileLoader).toContain("Boolean(professional.is_ctp)");

    const publicTypeStart = profileLoader.indexOf(
      "export type PublicProfessionalProfileDetails = {",
    );
    const publicTypeEnd = profileLoader.indexOf("};", publicTypeStart);
    const publicType = profileLoader.slice(publicTypeStart, publicTypeEnd);

    expect(publicType).toContain("is_ctu: boolean");
    expect(publicType).toContain("is_ctp: boolean");

    const publicLoaderStart = profileLoader.indexOf(
      "export async function loadPublicProfessionalProfile(",
    );
    const publicLoader = profileLoader.slice(publicLoaderStart);

    expect(publicLoader).toContain(
      "is_ctu: Boolean(professional.is_ctu)",
    );
    expect(publicLoader).toContain(
      "is_ctp: Boolean(professional.is_ctp)",
    );
  });

  it("exposes CTU / CTP in public directory rows", () => {
    expect(directoryApi).toContain(
      "available_remote, available_travel, is_ctu, is_ctp",
    );
  });

  it("supports CTU / CTP search filters", () => {
    expect(directoryApi).toContain(
      'parseBoolean(searchParams.get("is_ctu"))',
    );
    expect(directoryApi).toContain(
      'parseBoolean(searchParams.get("is_ctp"))',
    );
    expect(directoryApi).toContain('.eq("is_ctu", isCtu)');
    expect(directoryApi).toContain('.eq("is_ctp", isCtp)');
  });

  it("allows owner profile updates for CTU / CTP", () => {
    expect(detailApi).toContain("payload.is_ctu");
    expect(detailApi).toContain("payload.is_ctp");
    expect(detailApi).toContain("professionalUpdates.is_ctu");
    expect(detailApi).toContain("professionalUpdates.is_ctp");
  });
});
