import type { MetadataRoute } from "next";

import { CANONICAL_SITE_URL } from "@/lib/site-url";
import { isProfessionalVisibleToCustomers } from "@/lib/server/professional-visibility";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const PUBLIC_ROUTES = [
  "/",
  "/cerca",
  "/chi-siamo",
  "/cliente",
  "/professional",
  "/contattaci",
  "/centro-assistenza",
  "/faq",
  "/proponi-un-tecnico",
  "/privacy",
  "/cookie-policy",
  "/termini-di-servizio",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((path) => ({
    url: `${CANONICAL_SITE_URL}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" || path === "/cerca" ? "daily" : "monthly",
    priority:
      path === "/"
        ? 1
        : path === "/cerca"
          ? 0.9
          : path === "/chi-siamo"
            ? 0.7
            : 0.5,
  }));

  try {
    const service = createServiceClient();

    const { data: professionals, error } = await service
      .from("professional_directory")
      .select("id");

    if (error || !professionals?.length) {
      return staticEntries;
    }

    const visibility = await Promise.all(
      professionals.map(async ({ id }) => ({
        id,
        visible: await isProfessionalVisibleToCustomers(id, service),
      })),
    );

    const professionalEntries: MetadataRoute.Sitemap = visibility
      .filter(
        (
          item,
        ): item is {
          id: string;
          visible: true;
        } => item.visible === true && typeof item.id === "string",
      )
      .map(({ id }) => ({
        url: `${CANONICAL_SITE_URL}/professionisti/${encodeURIComponent(id)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));

    return [...staticEntries, ...professionalEntries];
  } catch {
    return staticEntries;
  }
}
