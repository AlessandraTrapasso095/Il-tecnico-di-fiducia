import type { MetadataRoute } from "next";

import { CANONICAL_SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/admin/",
        "/auth/",
        "/customer",
        "/customer/",
        "/messages",
        "/messages/",
        "/professionista",
        "/professionista/",
      ],
    },
    sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
    host: CANONICAL_SITE_URL,
  };
}
