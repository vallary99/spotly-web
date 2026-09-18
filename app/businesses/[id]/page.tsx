import { permanentRedirect, notFound } from "next/navigation";
import { api } from "@/lib/api";
import { businessHref } from "@/lib/urls";

// Val, Sep 2026: "set the old links as permanent redirects." The
// canonical business URL is now /{city}/{slug} (see [city]/[slug]/
// page.tsx) — this route's only job now is resolving an old
// /businesses/{id} link (still out there in bookmarks, past shares,
// and anything Google already indexed) to the new URL via a real
// permanent redirect (308), not a client-side bounce or a broken link.
// A ?product= query param, if present, carries through unchanged.
export default async function LegacyBusinessRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ product?: string }>;
}) {
  const { id } = await params;
  const { product } = await searchParams;

  let business;
  try {
    business = await api.businesses.get(id);
  } catch {
    notFound();
  }

  const target = businessHref(business) + (product ? `?product=${product}` : "");
  permanentRedirect(target);
}
