import type { MetadataRoute } from "next";

const SITE_URL = "https://spotly.co.ke";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is genuinely private data — these are just pages
      // that only make sense for a signed-in owner/user and have no
      // search-relevant content of their own to index (an empty saved
      // list or a login-gated dashboard shell isn't useful in results).
      disallow: ["/dashboard", "/saved", "/auth/", "/reset-password", "/forgot-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
