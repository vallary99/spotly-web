import type { Business } from "./api";

// Val, Sep 2026 SEO spec, Section 1 — the one place that decides what a
// business's canonical link looks like, used by every component that
// links to one, so they can never drift out of sync with each other.
// Falls back to the old /businesses/{id} route (which itself now
// redirects) only if city/slug are genuinely missing — shouldn't
// happen for anything created after the slug migration, but a stale
// cached object or an old response shape shouldn't produce a broken
// link.
export function businessHref(business: Pick<Business, "id" | "slug" | "city">): string {
  if (business.slug && business.city) {
    return `/${encodeURIComponent(business.city.toLowerCase())}/${business.slug}`;
  }
  return `/businesses/${business.id}`;
}
