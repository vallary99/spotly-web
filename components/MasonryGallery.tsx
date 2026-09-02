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
// large item at a time, not a whole grid of them).
//
// Videos sit in the same grid as photos (a real gallery, not a separate
// section) AND open the same full-screen Lightbox as photos do (Val,
// Sep 2026: "confirm even videos behave the same way... full screen and
// scrollable") — tapping a video tile opens it full-screen with the
// same vertical swipe-between-items gesture, rather than playing inline
// in the grid the way it used to. The grid tile itself is now just a
// muted preview (no native controls) with a play-icon overlay so it
// still reads as "this is a video, tap it" at a glance.
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

  if (visible.length === 0) {
    return <div className="h-[280px] w-full rounded-[28px] bg-cream" />;
  }

  return (
    <>
      {/* Tighter on mobile specifically (smaller gap, larger radius,
          closer to edge-to-edge) — desktop's spacing/radius (sm: and up)
          is untouched from before. */}
      <div className="columns-2 gap-1.5 sm:columns-2 sm:gap-3 md:columns-3 lg:columns-4">
        {visible.map((item, i) => (
          <button
            key={item.url}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="relative mb-1.5 block w-full break-inside-avoid overflow-hidden rounded-[22px] bg-cream transition hover:opacity-90 sm:mb-3 sm:rounded-2xl"
          >
            {item.type === "VIDEO" ? (
              <>
                <video
                  src={item.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="block w-full bg-black"
                  onError={() => setFailedUrls((prev) => new Set(prev).add(item.url))}
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-xl text-white">
                    <i className="bi bi-play-fill" />
                  </span>
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={`${businessName} photo ${i + 1}`}
                loading={i < 4 ? "eager" : "lazy"}
                className="block w-full"
                onError={() => setFailedUrls((prev) => new Set(prev).add(item.url))}
              />
            )}
          </button>
        ))}
      </div>

      {lightboxIndex != null && (
        <Lightbox
          media={visible}
          startIndex={lightboxIndex}
          alt={businessName}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
