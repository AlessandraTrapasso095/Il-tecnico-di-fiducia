import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const registration = readFileSync(
  "src/app/auth/register/register-client.tsx",
  "utf8",
);

const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");

const terms = readFileSync("src/app/termini-di-servizio/page.tsx", "utf8");

const cookie = readFileSync("src/app/cookie-policy/page.tsx", "utf8");

const footer = readFileSync("src/components/site/footer.tsx", "utf8");

describe("legal readiness contract", () => {
  it("requires acceptance during registration and states 18+", () => {
    expect(registration).toContain('type="checkbox"');
    expect(registration).toContain("acceptTerms");
    expect(registration).toContain("almeno 18 anni");
    expect(registration).toContain('href="/termini-di-servizio"');
    expect(registration).toContain('href="/privacy"');
  });

  it("identifies the privacy controller", () => {
    expect(privacy).toContain("Davide Mazza");
    expect(privacy).toContain("MZZDVD94D20I872A");
    expect(privacy).toContain("Via Massara 45");
    expect(privacy).toContain("info@iltecnicodifiducia.it");
  });

  it("states that registration is restricted to adults", () => {
    expect(privacy).toContain("18 anni");
    expect(terms).toContain("18 anni");
  });

  it("covers subscription cancellation and refunds conservatively", () => {
    expect(terms).toContain("rinnovi futuri");
    expect(terms).toContain("rimborso");
    expect(terms).toContain("diritti inderogabili");
  });

  it("covers applicable law and disputes", () => {
    expect(terms).toContain("legge italiana");
    expect(terms).toContain("foro competente");
    expect(terms).toContain("consumatore");
  });

  it("uses the new legal contact email", () => {
    expect(privacy).toContain("info@iltecnicodifiducia.it");
    expect(terms).toContain("info@iltecnicodifiducia.it");
    expect(cookie).toContain("info@iltecnicodifiducia.it");
  });

  it("links all main legal pages from the footer", () => {
    expect(footer).toContain('href="/termini-di-servizio"');
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/cookie-policy"');
  });
});
