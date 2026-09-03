import type { MetadataRoute } from "next";
import { api } from "@/lib/api";

const SITE_URL = "https://spotly.co.ke";

// Regenerated per-request by default (Next.js caches this on its own
// schedule) rather than baked in at build time — new businesses show
// up in the sitemap without needing a redeploy.
//
// KNOWN LIMIT worth revisiting as the business count grows: this reuses
// the same GET /businesses the homepage/search use, which is capped at
// 50 results server-side (BusinessService.findAll). Fine while the
// catalogue is still well under that; once it isn't, this needs either
// a dedicated unpaginated "all business IDs" endpoint or to page
// through results here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const businesses = await api.businesses.list();
    const businessRoutes: MetadataRoute.Sitemap = businesses.map((b) => ({
      url: `${SITE_URL}/businesses/${b.id}`,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...staticRoutes, ...businessRoutes];
  } catch {
    // A failed API call shouldn't take the whole sitemap down — worse
    // to have zero pages listed than to just miss the dynamic ones for
    // this one generation.
    return staticRoutes;
  }
}
