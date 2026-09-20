import type { Metadata } from "next";
import { api } from "@/lib/api";
import { resolveBusinessPhotoUrl } from "@/lib/placeholders";
import { generateBusinessSchema, isIndexable } from "@/lib/seo";
import { businessHref } from "@/lib/urls";
import BusinessDetailClient from "../../businesses/[id]/BusinessDetailClient";

// The permanent public business URL (Val, Sep 2026 SEO spec, Section 1)
// — /{city}/{slug}. Mirrors businesses/[id]/page.tsx's own metadata/
// JSON-LD logic exactly, just resolving via city+slug instead of a raw
// id; BusinessDetailClient itself is unchanged and reused as-is, since
// its own internal sub-resource fetches (offers, reviews, hosting
// history) are already id-based and don't need to know which route got
// them there.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ city: string; slug: string }>;
  searchParams: Promise<{ product?: string }>;
}): Promise<Metadata> {
  const { city, slug } = await params;
  const { product: productId } = await searchParams;
  const canonicalPath = `/${city}/${slug}`;

  if (productId) {
    try {
      const product = await api.products.getOne(productId);
      const description = product.description?.slice(0, 155) || `${product.name}, ${product.currency} ${product.price} on Spotly.`;
      const photo = product.images[0]?.url;
      return {
        title: product.name,
        description,
        alternates: { canonical: `${canonicalPath}?product=${productId}` },
        openGraph: {
          title: product.name,
          description,
          url: `${canonicalPath}?product=${productId}`,
          type: "website",
          images: photo ? [{ url: photo }] : undefined,
        },
        twitter: { card: "summary_large_image", title: product.name, description, images: photo ? [photo] : undefined },
      };
    } catch {
      // falls through to ordinary business metadata below
    }
  }

  try {
    const business = await api.businesses.getBySlug(city, slug);
    const photo = resolveBusinessPhotoUrl(business.media);
    const description =
      business.description?.slice(0, 155) ||
      `${business.name} on Spotly, ${business.neighborhood || "Nairobi"}. Discover it, save it, come back to it.`;
    return {
      title: business.name,
      description,
      alternates: { canonical: canonicalPath },
      robots: isIndexable(business) ? undefined : { index: false, follow: false },
      openGraph: { title: business.name, description, url: canonicalPath, type: "website", images: photo ? [{ url: photo }] : undefined },
      twitter: { card: "summary_large_image", title: business.name, description, images: photo ? [photo] : undefined },
    };
  } catch {
    return {};
  }
}

export default async function BusinessBySlugPage({ params }: { params: Promise<{ city: string; slug: string }> }) {
  const { city, slug } = await params;

  let jsonLd: Record<string, unknown> | null = null;
  let business: Awaited<ReturnType<typeof api.businesses.getBySlug>> | null = null;
  try {
    business = await api.businesses.getBySlug(city, slug);
    const photo = resolveBusinessPhotoUrl(business.media);
    jsonLd = isIndexable(business) ? generateBusinessSchema(business, photo, `https://spotly.co.ke${businessHref(business)}`) : null;
  } catch {
    jsonLd = null;
    business = null;
  }

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <BusinessDetailClient id={business?.id ?? ""} initialBusiness={business} />
    </>
  );
}
