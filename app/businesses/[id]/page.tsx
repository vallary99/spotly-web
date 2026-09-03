import type { Metadata } from "next";
import { api } from "@/lib/api";
import { resolveBusinessPhotoUrl } from "@/lib/placeholders";
import BusinessDetailClient from "./BusinessDetailClient";

// This file exists purely so each business gets its own title,
// description, and share-preview image — the actual interactive page
// is BusinessDetailClient.tsx, a client component (state, effects,
// event handlers throughout), and Next.js only allows a `metadata` /
// generateMetadata export from a server component. Splitting the two
// apart is what makes "unique per-business SEO + WhatsApp/social link
// previews" possible at all here (Val, Sep 2026: search results/shares
// were all showing the same generic Spotly title regardless of which
// business the link was actually for).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const business = await api.businesses.get(id);
    const photo = resolveBusinessPhotoUrl(business.media);
    const description =
      business.description?.slice(0, 155) ||
      `${business.name} on Spotly — ${business.neighborhood || "Nairobi"}. Discover it, save it, come back to it.`;
    return {
      title: business.name,
      description,
      alternates: { canonical: `/businesses/${id}` },
      openGraph: {
        title: business.name,
        description,
        url: `/businesses/${id}`,
        type: "website",
        images: photo ? [{ url: photo }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: business.name,
        description,
        images: photo ? [photo] : undefined,
      },
    };
  } catch {
    // A missing/unreachable business shouldn't crash metadata
    // generation — falls back to the root layout's generic metadata,
    // same as any other page that doesn't override it.
    return {};
  }
}

export default async function BusinessDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Same reasoning as the root layout's WebSite structured data — gives
  // search engines explicit facts about this specific business rather
  // than relying on inference. Best-effort: a fetch failure here just
  // means no structured data for this one request, not a broken page —
  // BusinessDetailClient does its own fetching/error handling for the
  // actual visible content regardless.
  let jsonLd: Record<string, unknown> | null = null;
  try {
    const business = await api.businesses.get(id);
    const photo = resolveBusinessPhotoUrl(business.media);
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: business.name,
      description: business.description || undefined,
      image: photo || undefined,
      address: business.address
        ? { "@type": "PostalAddress", streetAddress: business.address, addressLocality: business.neighborhood || "Nairobi", addressCountry: "KE" }
        : undefined,
      telephone: business.callPhone || undefined,
      url: `https://spotly.co.ke/businesses/${id}`,
      ...(business.latitude != null && business.longitude != null
        ? { geo: { "@type": "GeoCoordinates", latitude: business.latitude, longitude: business.longitude } }
        : {}),
    };
  } catch {
    jsonLd = null;
  }

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <BusinessDetailClient id={id} />
    </>
  );
}
