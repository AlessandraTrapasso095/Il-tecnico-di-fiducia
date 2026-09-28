import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const robots = readFileSync("src/app/robots.ts", "utf8");
const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
const manifest = readFileSync("src/app/manifest.ts", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");

const professionalProfile = readFileSync(
  "src/app/professionisti/[id]/page.tsx",
  "utf8",
);

const siteUrl = readFileSync("src/lib/site-url.ts", "utf8");

describe("technical SEO production contract", () => {
  it("uses the canonical www production domain", () => {
    expect(siteUrl).toContain("https://www.iltecnicodifiducia.it");

    expect(rootLayout).toContain("metadataBase");
    expect(rootLayout).toContain("alternates");
    expect(rootLayout).toContain('canonical: "/"');
  });

  it("publishes robots and sitemap metadata routes", () => {
    expect(robots).toContain("MetadataRoute.Robots");
    expect(robots).toContain("/sitemap.xml");

    expect(sitemap).toContain("MetadataRoute.Sitemap");
    expect(sitemap).toContain("PUBLIC_ROUTES");
  });

  it("keeps private and authentication areas out of search engines", () => {
    for (const path of [
      "/api/",
      "/admin",
      "/auth/",
      "/customer",
      "/messages",
      "/professionista",
    ]) {
      expect(robots).toContain(path);
    }

    expect(nextConfig).toContain("X-Robots-Tag");
    expect(nextConfig).toContain("noindex, nofollow, noarchive");
  });

  it("publishes social sharing metadata", () => {
    expect(rootLayout).toContain("openGraph");
    expect(rootLayout).toContain("twitter");
    expect(rootLayout).toContain("/img/logo-mark.png");
  });

  it("publishes a web manifest", () => {
    expect(rootLayout).toContain('manifest: "/manifest.webmanifest"');

    expect(manifest).toContain("MetadataRoute.Manifest");
    expect(manifest).toContain('name: "Il Tecnico di Fiducia"');
  });

  it("only adds visible professionals to the dynamic sitemap", () => {
    expect(sitemap).toContain("isProfessionalVisibleToCustomers");

    expect(sitemap).toContain("/professionisti/${encodeURIComponent(id)}");
  });

  it("creates dynamic SEO metadata for public professional profiles", () => {
    expect(professionalProfile).toContain(
      "export async function generateMetadata",
    );

    expect(professionalProfile).toContain("getPublicProfessionalProfile(id)");

    expect(professionalProfile).toContain("canonical: canonicalPath");

    expect(professionalProfile).toContain("index: false");

    expect(professionalProfile).toContain("index: true");
  });

  it("gives every main static public route its own canonical", () => {
    const expected = {
      cerca: "/cerca",
      "chi-siamo": "/chi-siamo",
      cliente: "/cliente",
      professional: "/professional",
      contattaci: "/contattaci",
      "centro-assistenza": "/centro-assistenza",
      faq: "/faq",
      "proponi-un-tecnico": "/proponi-un-tecnico",
      privacy: "/privacy",
      "cookie-policy": "/cookie-policy",
      "termini-di-servizio": "/termini-di-servizio",
    };

    for (const [route, canonical] of Object.entries(expected)) {
      const layout = readFileSync(`src/app/${route}/layout.tsx`, "utf8");

      expect(layout).toContain(`canonical: "${canonical}"`);
    }
  });
});
