"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Full-screen media viewer — "Gallery = discovery, full-screen viewer =
// inspection." Supports swipe between images, pinch-to-zoom (and
// double-tap as a one-handed equivalent), an image counter, and
// keyboard navigation for non-touch devices.
export function Lightbox({
  images,
  startIndex = 0,
  alt,
  onClose,
}: {
  images: string[];
  startIndex?: number;
  alt: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  // Tracks which images in this set failed to load (e.g. a dead/stale
  // storage URL) so we can show a clear placeholder instead of either a
  // browser broken-image icon or, worse, letting next/image's fetch
  // error bubble up as an unhandled one.
  const [brokenIdx, setBrokenIdx] = useState<Set<number>>(new Set());
  const pinchState = useRef<{ startDist: number; startScale: number } | null>(null);
  const panState = useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const lastTapRef = useRef(0);

  const resetZoom = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= images.length) return;
    setIdx(next);
    resetZoom();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(idx + 1);
      if (e.key === "ArrowLeft") goTo(idx - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, onClose]);

  const dist = (touches: React.TouchList) => {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchState.current = { startDist: dist(e.touches), startScale: scale };
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        panState.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, origin: translate };
      } else {
        swipeStartX.current = e.touches[0].clientX;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current) {
      const ratio = dist(e.touches) / pinchState.current.startDist;
      setScale(Math.min(4, Math.max(1, pinchState.current.startScale * ratio)));
    } else if (e.touches.length === 1 && panState.current) {
      const dx = e.touches[0].clientX - panState.current.startX;
      const dy = e.touches[0].clientY - panState.current.startY;
      setTranslate({ x: panState.current.origin.x + dx, y: panState.current.origin.y + dy });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    pinchState.current = null;
    panState.current = null;
    if (scale === 1 && swipeStartX.current != null && e.changedTouches.length === 1) {
      const delta = e.changedTouches[0].clientX - swipeStartX.current;
      if (Math.abs(delta) > 60) goTo(delta < 0 ? idx + 1 : idx - 1);
    }
    swipeStartX.current = null;

    // Double-tap to zoom, a one-handed equivalent to pinch, common on
    // mobile where reaching for a second finger mid-browse is awkward.
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setScale((s) => (s > 1 ? 1 : 2));
      setTranslate({ x: 0, y: 0 });
    }
    lastTapRef.current = now;
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-[rgba(20,15,12,0.92)]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25"
        aria-label="Close"
      >
        <i className="bi bi-x-lg" />
      </button>

      {images.length > 1 && (
        <span className="absolute left-5 top-5 z-[2] rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white">
          {idx + 1} / {images.length}
        </span>
      )}

      {images.length > 1 && idx > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goTo(idx - 1);
          }}
          className="absolute left-4 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25 max-md:hidden"
          aria-label="Previous photo"
        >
          <i className="bi bi-chevron-left" />
        </button>
      )}
      {images.length > 1 && idx < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goTo(idx + 1);
          }}
          className="absolute right-4 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25 max-md:hidden"
          aria-label="Next photo"
        >
          <i className="bi bi-chevron-right" />
        </button>
      )}

      <div
        className="relative h-full max-h-[88vh] w-full max-w-5xl touch-none px-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative h-full w-full transition-transform duration-150"
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
        >
          {brokenIdx.has(idx) ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/60">
              <i className="bi bi-image text-4xl" />
              <span className="text-sm">This photo isn&apos;t available.</span>
            </div>
          ) : (
            <Image
              src={images[idx]}
              alt={alt}
              fill
              sizes="90vw"
              priority
              className="object-contain"
              onError={() => setBrokenIdx((prev) => new Set(prev).add(idx))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
