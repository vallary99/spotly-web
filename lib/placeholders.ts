// Guaranteed-reliable local placeholder is no longer used as a rendered
// image at all (see BusinessCard/BusinessGallery) — a business with no
// real approved photo, or one whose photo fails to load, now shows a
// plain blank background instead of attempting any stock/fallback
// imagery. This removes the whole class of problem where a fallback
// image ALSO fails (a specific Unsplash photo ID going stale, a network
// hiccup reaching an external host) and leaves nothing after it. Kept
// only as an asset path in case a future design wants a static "no
// photo yet" graphic somewhere.
export const LOCAL_FALLBACK = "/placeholder-business.jpg";

// Mirrors next.config.ts's images.remotePatterns. next/image throws a
// hard, uncaught error (not just a broken-image icon) for any hostname
// not explicitly allowed there — so a stray/unexpected media URL (bad
// test data, a manually-edited DB row, a future storage migration that
// leaves old URLs behind) could otherwise take down the entire page
// it's rendered on. Checking here means the worst case is a blank
// background, never a crash.
const ALLOWED_IMAGE_HOSTS = [
  /^images\.unsplash\.com$/,
  /^i\.pravatar\.cc$/,
  /^localhost:3000$/,
  /(^|\.)s3\.amazonaws\.com$/,
  /(^|\.)r2\.dev$/,
  /(^|\.)r2\.cloudflarestorage\.com$/,
];

export function isAllowedImageUrl(url: string): boolean {
  try {
    const { hostname, port } = new URL(url);
    const host = port ? `${hostname}:${port}` : hostname;
    return ALLOWED_IMAGE_HOSTS.some((pattern) => pattern.test(host));
  } catch {
    return false; // not even a valid URL
  }
}

// Returns the business's real approved photo URL, or null if it has
// none (or none that pass the host safety check). No stock-photo
// fallback here anymore — callers render a blank background instead of
// calling this when it returns null. This is the ONLY thing that
// changed in intent from the old businessImage()/categoryFallbackImage()
// pair: same host-safety check, but no external "pretty" fallback.
export function resolveBusinessPhotoUrl(media?: { url: string; status: string; type?: string }[]): string | null {
  // Explicitly requires type === "PHOTO" (when the field is present) —
  // this same media array can now include approved videos too (see
  // BusinessService.attachRatingsAndStripMetrics), and a card's single
  // thumbnail has to stay a real photo; a video URL rendered through a
  // plain <img> tag just shows as broken.
  const approved = media?.find((m) => m.status === "APPROVED" && (!m.type || m.type === "PHOTO") && isAllowedImageUrl(m.url));
  return approved ? approved.url : null;
}

// Reverted to the original set per explicit instruction — the
// African-representation replacement from the prior round read as
// blending less well with the gradient/text-legibility treatment over
// it. Worth knowing: this does undo that representation goal, flagged
// in the chat response rather than silently dropped.
export const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1521017432531-fbd92d768814?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?q=80&w=1600&auto=format&fit=crop",
];
