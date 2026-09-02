"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { GalleryMediaItem } from "./MasonryGallery";

const SWIPE_THRESHOLD = 45; // px of vertical drag before a swipe commits
const FLICK_VELOCITY = 0.3; // px/ms (~300px/s) — a quick flick commits
const SETTLE_MS = 260; // must match the inline transition duration below

// Full-screen media viewer — "Gallery = discovery, full-screen viewer =
// inspection." Touch users swipe vertically between items (up = next,
// down = previous) with the item following your finger live and either
// completing the slide or snapping back, matching the feel of
// TikTok/Reels/Stories (Val, Sep 2026: "can the full screen be better,
// just like on TikTok") — desktop is untouched and still uses the
// visible left/right arrow buttons plus ArrowLeft/ArrowRight on the
// keyboard (an instant cut, no slide), since neither of those ever
// fires from a touch drag anyway.
//
// Deliberately NOT copied from TikTok: video is never cropped to fill
// the screen — it stays `object-contain`, same as photos, consistent
// with the gallery grid's "never crop, natural aspect ratio" rule.
// There's also no like/comment/share rail — nothing in Spotly maps to
// that, so it isn't included just because TikTok has one.
//
// Video plays with a custom minimal progress bar (tap to play/pause,
// tap the bar to seek) instead of the browser's native controls, which
// is what actually reads as "app", not "a video embedded in a
// webpage". Only the CURRENT item gets this — the prev/next items
// peeking in during a drag render as static, muted, non-autoplaying
// previews (first frame only via preload="metadata") so a swipe never
// has two videos actually playing/decoding at once.
export function Lightbox({
  media,
  startIndex = 0,
  alt,
  onClose,
}: {
  media: GalleryMediaItem[];
  startIndex?: number;
  alt: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  // Tracks which items in this set failed to load (e.g. a dead/stale
  // storage URL) so we can show a clear placeholder instead of either a
  // browser broken-image icon or, worse, letting next/image's fetch
  // error bubble up as an unhandled one.
  const [brokenIdx, setBrokenIdx] = useState<Set<number>>(new Set());
  const pinchState = useRef<{ startDist: number; startScale: number } | null>(null);
  const panState = useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null);

  // --- Vertical drag-to-swipe stack (touch only) ---
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isSettling, setIsSettling] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragYRef = useRef(0); // mirrors dragY state, read at touchend so
  // the commit decision never depends on whether React's state update
  // from the last touchmove has actually re-rendered yet.
  const lastMove = useRef<{ y: number; t: number } | null>(null);
  const velocityRef = useRef(0); // px/ms, signed — negative means moving
  // up (toward "next"). Continuously updated from the most recent pair
  // of touchmove samples, so by touchend it approximates release
  // velocity, the same technique real gesture libraries use. Needed
  // because a fast flick is often SHORT in total distance — measuring
  // distance alone (SWIPE_THRESHOLD) misses exactly the decisive, quick
  // swipes this is meant to catch.
  const pendingDirection = useRef<1 | -1 | null>(null);
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef(false); // guards against double-commit if
  // both the transitionend event AND the fallback timer below fire

  // --- Custom video controls (current item only) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0); // 0..1
  const lastTapRef = useRef(0);

  const current = media[idx];
  const isVideo = current?.type === "VIDEO";

  useEffect(() => {
    const measure = () => setContainerHeight(containerRef.current?.clientHeight ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const resetZoom = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // Desktop-only path (arrow buttons, keyboard) — an instant cut, no
  // slide. Left exactly as it worked before this change, since Val was
  // explicit desktop shouldn't change.
  const goTo = (next: number) => {
    if (next < 0 || next >= media.length) return;
    setIdx(next);
    resetZoom();
  };

  useEffect(() => {
    setVideoPlaying(true);
    setVideoProgress(0);
  }, [idx]);

  useEffect(() => {
    // Locks the underlying page's scroll while the viewer is open —
    // without this, part of a swipe gesture can leak through and
    // scroll the page *behind* this fixed overlay instead of being
    // read by the touch handlers below (a known mobile-Safari
    // behavior), which shows up as swipes needing far more distance
    // than they should to register. Same pattern BottomSheet.tsx
    // already uses for the same reason.
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    return () => {
      if (settleTimeout.current) clearTimeout(settleTimeout.current);
    };
  }, []);

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

  const dist = (touches: { [i: number]: { clientX: number; clientY: number } }) => {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Video doesn't get pinch/double-tap zoom — a playing video's
    // controls (scrub bar, play/pause) need normal taps to reach it,
    // and "zoom in on a video" isn't a meaningful inspection action the
    // way it is for a still photo.
    if (e.touches.length === 2 && !isVideo) {
      pinchState.current = { startDist: dist(e.touches), startScale: scale };
    } else if (e.touches.length === 1) {
      if (scale > 1 && !isVideo) {
        panState.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, origin: translate };
      } else {
        // If a previous swipe's slide/snap-back animation hasn't
        // actually finished yet (still settling, or its fallback timer
        // hasn't fired) and a NEW drag starts anyway — which happens
        // constantly with two natural swipes in quick succession — the
        // new drag's touchmove would immediately start overwriting
        // `dragY` while `isSettling` from the OLD one is still true,
        // meaning the new drag's live-follow gets animated through the
        // old 260ms transition instead of tracking the finger 1:1
        // (feels laggy/stuck), AND the old pending index change can
        // still fire later — via its transitionend or fallback timer —
        // in the middle of the new gesture, using stale direction data.
        // Resolving the old one immediately, synchronously, before the
        // new drag's start values are recorded, prevents both: this is
        // a no-op if the old one already finished (see
        // handleStackTransitionEnd's committedRef guard).
        handleStackTransitionEnd();

        dragStartY.current = e.touches[0].clientY;
        dragYRef.current = 0;
        lastMove.current = { y: e.touches[0].clientY, t: performance.now() };
        velocityRef.current = 0;
      }
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const ratio = dist(e.touches) / pinchState.current.startDist;
      setScale(Math.min(4, Math.max(1, pinchState.current.startScale * ratio)));
    } else if (e.touches.length === 1 && panState.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panState.current.startX;
      const dy = e.touches[0].clientY - panState.current.startY;
      setTranslate({ x: panState.current.origin.x + dx, y: panState.current.origin.y + dy });
    } else if (e.touches.length === 1 && dragStartY.current != null && scale === 1) {
      // Explicit preventDefault, not just relying on the touch-none CSS
      // class — touch-action is supposed to be enough on its own, but
      // browser compliance varies, and without this the browser can
      // still be processing its own native scroll/gesture handling
      // underneath at the same time as this JS-driven drag, competing
      // with it (which shows up as the content barely moving even
      // though you're dragging a long way).
      e.preventDefault();
      let delta = e.touches[0].clientY - dragStartY.current;
      // Soft resistance rather than a hard wall when there's no
      // neighbor to reveal in that direction (first/last item) — still
      // moves a little under your finger so it doesn't feel frozen,
      // just settles right back since there's nowhere for it to go.
      if (delta < 0 && idx === media.length - 1) delta /= 4;
      if (delta > 0 && idx === 0) delta /= 4;
      dragYRef.current = delta;
      setDragY(delta);

      const now = performance.now();
      if (lastMove.current) {
        const dt = now - lastMove.current.t;
        if (dt > 0) velocityRef.current = (e.touches[0].clientY - lastMove.current.y) / dt;
      }
      lastMove.current = { y: e.touches[0].clientY, t: now };
    }
  };

  // touchmove is attached natively with { passive: false } rather than
  // via JSX's onTouchMove — React registers its own delegated touchmove
  // listener as passive by default (for scroll performance), which
  // means e.preventDefault() called from inside a JSX onTouchMove
  // handler can silently do nothing. Without a real, working
  // preventDefault here, the browser's native scroll/gesture handling
  // keeps running underneath this JS-driven drag at the same time,
  // fighting it — which is what was actually causing swipes to need far
  // more physical distance than SWIPE_THRESHOLD should require (Val,
  // Sep 2026). handleTouchMoveRef always holds the latest closure so
  // this effect only needs to run once.
  const handleTouchMoveRef = useRef(handleTouchMove);
  handleTouchMoveRef.current = handleTouchMove;
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const listener = (e: TouchEvent) => handleTouchMoveRef.current(e);
    el.addEventListener("touchmove", listener, { passive: false });
    return () => el.removeEventListener("touchmove", listener);
  }, []);

  const handleTouchEnd = (e: React.TouchEvent) => {
    pinchState.current = null;
    panState.current = null;

    if (dragStartY.current != null && scale === 1) {
      const finalDragY = dragYRef.current;
      const velocity = velocityRef.current;
      // Commits on EITHER a long-enough drag OR a fast-enough flick —
      // a quick short swipe has small `finalDragY` but a large
      // `velocity`, and needs to commit just as much as a slow long
      // drag does.
      const goingNext = idx < media.length - 1 && (finalDragY < -SWIPE_THRESHOLD || (velocity < -FLICK_VELOCITY && finalDragY < -10));
      const goingPrev = idx > 0 && (finalDragY > SWIPE_THRESHOLD || (velocity > FLICK_VELOCITY && finalDragY > 10));
      committedRef.current = false;
      if (goingNext || goingPrev) {
        pendingDirection.current = goingNext ? 1 : -1;
        setIsSettling(true);
        setDragY(goingNext ? -containerHeight : containerHeight);
      } else {
        pendingDirection.current = null;
        setIsSettling(true);
        setDragY(0);
      }
      // Fallback in case `transitionend` never fires — e.g. a fast
      // swipe already dragged the item to (or past, before the
      // resistance clamp) its exact target position, so the value set
      // above doesn't actually change and the browser never fires the
      // event handleStackTransitionEnd is waiting on. Without this,
      // the index silently never advances even though the item looks
      // like it moved on, and the *next* touch appears to "snap back"
      // to what was secretly still the current item.
      if (settleTimeout.current) clearTimeout(settleTimeout.current);
      settleTimeout.current = setTimeout(handleStackTransitionEnd, SETTLE_MS + 60);
    }
    dragStartY.current = null;

    if (isVideo) return; // no double-tap-to-zoom for video, see handleTouchStart

    // Double-tap to zoom, a one-handed equivalent to pinch, common on
    // mobile where reaching for a second finger mid-browse is awkward.
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setScale((s) => (s > 1 ? 1 : 2));
      setTranslate({ x: 0, y: 0 });
    }
    lastTapRef.current = now;
  };

  // Fires once the slide/snap-back CSS transition finishes. If a swipe
  // committed (pendingDirection set), this is the moment idx actually
  // changes — dragY resets to 0 with the transition disabled in the
  // same update, which is invisible because the item that's becoming
  // "current" was already sitting at that exact screen position the
  // instant before this fires.
  const handleStackTransitionEnd = () => {
    if (committedRef.current) return; // already handled by the other trigger
    committedRef.current = true;
    if (settleTimeout.current) {
      clearTimeout(settleTimeout.current);
      settleTimeout.current = null;
    }
    // Snapshot into a plain local BEFORE nulling the ref — setIdx's
    // updater function doesn't run synchronously the instant it's
    // called, React defers it slightly. The very next line here nulls
    // `pendingDirection.current`, and if the updater read that ref
    // directly it would see `null` by the time it actually runs
    // (`prev + null` === `prev + 0`, i.e. idx silently never changes
    // at all, no matter how correctly the swipe itself was detected —
    // this was the actual root cause of the whole issue, Sep 2026).
    const direction = pendingDirection.current;
    if (direction != null) {
      setIdx((prev) => prev + direction);
      resetZoom();
      pendingDirection.current = null;
    }
    setIsSettling(false);
    setDragY(0);
    dragYRef.current = 0;
  };

  const stackStyle = (offset: number): React.CSSProperties => ({
    transform: `translateY(${offset + dragY}px)`,
    transition: isSettling ? `transform ${SETTLE_MS}ms ease-out` : "none",
  });

  const toggleVideoPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setVideoPlaying(true);
    } else {
      v.pause();
      setVideoPlaying(false);
    }
  };

  const seekVideo = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  };

  const renderPeek = (item: GalleryMediaItem | undefined, i: number) => {
    if (!item) return null;
    if (brokenIdx.has(i)) {
      return (
        <div className="flex h-full w-full items-center justify-center text-white/40">
          <i className={`bi ${item.type === "VIDEO" ? "bi-camera-video-off" : "bi-image"} text-3xl`} />
        </div>
      );
    }
    if (item.type === "VIDEO") {
      // Static preview only — no autoplay, no controls — so a drag
      // never has more than one video actually decoding/playing.
      return (
        <video
          src={item.url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
          onError={() => setBrokenIdx((prev) => new Set(prev).add(i))}
        />
      );
    }
    return (
      <Image
        src={item.url}
        alt={alt}
        fill
        sizes="90vw"
        className="object-contain"
        onError={() => setBrokenIdx((prev) => new Set(prev).add(i))}
      />
    );
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[400] flex touch-none items-center justify-center bg-[rgba(20,15,12,0.92)]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25"
        aria-label="Close"
      >
        <i className="bi bi-x-lg" />
      </button>

      {media.length > 1 && (
        <span className="absolute left-5 top-5 z-[2] rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white">
          {idx + 1} / {media.length}
        </span>
      )}

      {media.length > 1 && idx > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goTo(idx - 1);
          }}
          className="absolute left-4 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25 max-md:hidden"
          aria-label="Previous"
        >
          <i className="bi bi-chevron-left" />
        </button>
      )}
      {media.length > 1 && idx < media.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goTo(idx + 1);
          }}
          className="absolute right-4 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25 max-md:hidden"
          aria-label="Next"
        >
          <i className="bi bi-chevron-right" />
        </button>
      )}

      <div
        ref={containerRef}
        className="relative h-full max-h-[88vh] w-full max-w-5xl overflow-hidden px-4"
      >
        {idx > 0 && (
          <div className="absolute inset-0" style={stackStyle(-containerHeight)}>
            {renderPeek(media[idx - 1], idx - 1)}
          </div>
        )}

        <div className="absolute inset-0" style={stackStyle(0)} onTransitionEnd={handleStackTransitionEnd}>
          <div
            className="relative h-full w-full transition-transform duration-150"
            style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
          >
            {brokenIdx.has(idx) ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/60">
                <i className={`bi ${isVideo ? "bi-camera-video-off" : "bi-image"} text-4xl`} />
                <span className="text-sm">This {isVideo ? "video" : "photo"} isn&apos;t available.</span>
              </div>
            ) : isVideo ? (
              <>
                {/* key={current.url} forces a fresh <video> element per
                    item rather than React reusing the same DOM node
                    across a swipe — reusing it would carry over
                    playback position/state from the previous video. */}
                <video
                  key={current.url}
                  ref={videoRef}
                  src={current.url}
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                  onClick={toggleVideoPlay}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration) setVideoProgress(v.currentTime / v.duration);
                  }}
                  onError={() => setBrokenIdx((prev) => new Set(prev).add(idx))}
                />
                {!videoPlaying && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 text-3xl text-white">
                      <i className="bi bi-play-fill" />
                    </span>
                  </div>
                )}
                {/* Minimal custom progress bar in place of native
                    controls — tap to seek. */}
                <div
                  className="absolute inset-x-0 bottom-0 h-6 px-1 pb-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    seekVideo(e);
                  }}
                >
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/25">
                    <div className="h-full rounded-full bg-white" style={{ width: `${videoProgress * 100}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <Image
                src={current.url}
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

        {idx < media.length - 1 && (
          <div className="absolute inset-0" style={stackStyle(containerHeight)}>
            {renderPeek(media[idx + 1], idx + 1)}
          </div>
        )}
      </div>
    </div>
  );
}
