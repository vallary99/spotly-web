"use client";

import { useState } from "react";
import { Lightbox } from "./Lightbox";

export interface GalleryMediaItem {
  url: string;
  type: "PHOTO" | "VIDEO";
}

// "Gallery = discovery, full-screen viewer = inspection." Uses CSS
// columns for true masonry, each tile renders at its own natural aspect
// ratio (no forced 16:9/4:3/1:1 crop), and plain <img>/<video> tags
// rather than next/image here specifically because next/image requires
// a known width/height (or an explicitly-sized `fill` parent) to avoid
// layout shift — since actual upload dimensions aren't stored, letting
// the browser size each tile naturally via CSS is what actually
// achieves "retain natural aspect ratio" correctly, at the cost of
// next/image's automatic format/resize optimization for these specific
// thumbnails (the full-screen Lightbox view still uses next/image for
// photos, which is where that optimization matters most anyway — one
// large image at a time, not a whole grid of them).
//
// Videos sit in the same grid as photos (a real gallery, not a separate
// section) but open with native browser controls in place rather than
// the photo Lightbox — pinch-to-zoom/pan genuinely doesn't apply to
// video, so there's no equivalent "inspection" view to open; the tile
// itself, played inline, already is that view.
//
// No stock-photo fallback: a business with no real approved media (or
// whose media all fails to load) shows a plain blank panel instead of
// any placeholder imagery, consistent with the rest of the app.
export function MasonryGallery({
  media,
  businessName,
}: {
  media: GalleryMediaItem[];
  businessName: string;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visible = media.filter((m) => !failedUrls.has(m.url));
  const photoUrls = visible.filter((m) => m.type === "PHOTO").map((m) => m.url);

  if (visible.length === 0) {
    return <div className="h-[280px] w-full rounded-[28px] bg-cream" />;
  }

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-2 md:columns-3 lg:columns-4">
        {visible.map((item, i) =>
          item.type === "VIDEO" ? (
            <div key={item.url} className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-black">
              <video
                src={item.url}
                controls
                className="block w-full"
                onError={() => setFailedUrls((prev) => new Set(prev).add(item.url))}
              />
            </div>
          ) : (
            <button
              key={item.url}
              type="button"
              onClick={() => setLightboxIndex(photoUrls.indexOf(item.url))}
              className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-cream transition hover:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={`${businessName} photo ${i + 1}`}
                loading={i < 4 ? "eager" : "lazy"}
                className="block w-full"
                onError={() => setFailedUrls((prev) => new Set(prev).add(item.url))}
              />
            </button>
          ),
        )}
      </div>

      {lightboxIndex != null && (
        <Lightbox
          images={photoUrls}
          startIndex={lightboxIndex}
          alt={businessName}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
