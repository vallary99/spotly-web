import type { Metadata } from "next";
import { api } from "@/lib/api";
import HomeClient from "@/components/HomeClient";

// Val, Sep 2026: "when sharing an event the user should see event
// details... I want something similar to how business profiles show
// when shared." The homepage itself is a client component (all the
// interactive rails/filters live there, unchanged, in HomeClient) and
// client components can't export generateMetadata — that's what left
// a shared ?experience= link showing only Spotly's generic site-wide
// preview, since nothing was ever generating per-event Open Graph tags
// for it. This thin server wrapper is exactly the same pattern
// businesses/[id]/page.tsx and [city]/[slug]/page.tsx already use:
// read the query param server-side, generate real metadata for it,
// render the actual (unchanged) client page underneath.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ experience?: string }>;
}): Promise<Metadata> {
  const { experience: experienceId } = await searchParams;
  if (!experienceId) return {};

  try {
    const experience = await api.experiences.getOne(experienceId);
    const photo = experience.images[0];
    const description =
      experience.description?.slice(0, 155) ||
      `${experience.title}${experience.businessName ? ` by ${experience.businessName}` : ""} on Spotly.`;
    const url = `https://spotly.co.ke/?experience=${experienceId}`;
    return {
      title: experience.title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title: experience.title,
        description,
        url,
        type: "website",
        images: photo ? [{ url: photo }] : undefined,
      },
      twitter: { card: "summary_large_image", title: experience.title, description, images: photo ? [photo] : undefined },
    };
  } catch {
    return {};
  }
}

export default function HomePage() {
  return <HomeClient />;
}
