"use client";

import { useRef, useState } from "react";
import { api, ApiError, type Media } from "@/lib/api";
import { useToast } from "./ToastContext";
import { Lightbox } from "./Lightbox";

const LONG_PRESS_MS = 500;

// Deliberately minimal — only the fields this component actually reads,
// same reasoning as the dashboard page's own local TierLimits alias
// (which this mirrors rather than importing the API client's fuller
// TierLimit, to avoid requiring fields neither of them uses here).
interface GalleryTierLimits {
  photos: number;
  videos: number;
  videoMaxSeconds: number;
}

// Separated out from the profile-info form entirely (Val, Sep 2026:
// "so they don't have to scroll to the bottom to see their media or
// upload") — this is its own dashboard tab now, not the last thing at
// the end of a long page. Combines what used to be two separate
// sections (MediaSection for photos, VideoSection for videos) into one
// grid, the same way the PUBLIC profile's gallery already mixes both —
// but denser: more columns, smaller tiles, matching Pinterest's own
// "my profile" grid rather than its main following feed, which is
// wider/looser (Val: "the same Pinterest outlook... but smaller like on
// Pinterest profile").
export function DashboardGallery({
  businessId,
  media,
  coverMediaId,
  tier,
  tiers,
  onChanged,
}: {
  businessId: string;
  media: Media[];
  coverMediaId: string | null;
  tier: string;
  tiers: Record<string, GalleryTierLimits> | null;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [busyPhotos, setBusyPhotos] = useState(false);
  const [busyVideos, setBusyVideos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // The item currently showing its long-press action menu — null means
  // none open. A separate piece of state from lightboxIndex since the
  // two are mutually exclusive interactions on the same tile (short
  // press views, long press manages).
  const [menuFor, setMenuFor] = useState<Media | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const photos = media.filter((m) => m.type === "PHOTO" && m.status === "APPROVED");
  const videos = media.filter((m) => m.type === "VIDEO" && m.status === "APPROVED");
  const items = media.filter((m) => (m.type === "PHOTO" || m.type === "VIDEO") && m.status === "APPROVED");

  const photoLimit = tiers?.[tier]?.photos ?? 0;
  const videoLimit = tiers?.[tier]?.videos ?? 0;
  const videoMaxSeconds = tiers?.[tier]?.videoMaxSeconds ?? 60;

  // Same "load into a throwaway <video>, read its metadata, no upload
  // needed yet" approach VideoSection always used.
  const getDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Couldn't read that video file."));
      };
      video.src = URL.createObjectURL(file);
    });

  // Sequential, not parallel — same reasoning as before (the server
  // re-checks the tier cap fresh from the database on every call, so
  // parallel uploads could each see "room left" before either one's
  // record actually exists, letting a batch slip past the limit).
  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusyPhotos(true);
    setError(null);
    let succeeded = 0;
    let capHit = false;
    let lastError: string | null = null;

    for (const file of files) {
      if (photos.length + succeeded >= photoLimit) {
        capHit = true;
        break;
      }
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const { publicUrl, storageKey } = await api.media.getUploadUrl(businessId, "PHOTO", ext);
        const formData = new FormData();
        formData.append("file", file);
        await api.media.submit(businessId, formData, `type=PHOTO&url=${encodeURIComponent(publicUrl)}&storageKey=${encodeURIComponent(storageKey)}`);
        succeeded++;
      } catch (err) {
        lastError = err instanceof ApiError ? err.message : `Couldn't upload ${file.name}.`;
      }
    }

    if (succeeded > 0) {
      showToast(files.length === 1 ? "Photo published." : `${succeeded} of ${files.length} photos published.`);
      onChanged();
    }
    if (capHit) {
      setError(`Reached your ${tier} tier's limit of ${photoLimit} photos — ${files.length - succeeded} skipped.`);
    } else if (lastError) {
      setError(lastError);
    }
    setBusyPhotos(false);
    e.target.value = "";
  };

  const handleVideoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusyVideos(true);
    setError(null);
    let succeeded = 0;
    let capHit = false;
    let lastError: string | null = null;

    for (const file of files) {
      if (videos.length + succeeded >= videoLimit) {
        capHit = true;
        break;
      }
      try {
        const durationSeconds = Math.round(await getDuration(file));
        if (durationSeconds > videoMaxSeconds) {
          lastError = `${file.name} is ${durationSeconds}s, your ${tier} tier's limit is ${videoMaxSeconds}s.`;
          continue;
        }
        const ext = file.name.split(".").pop() || "mp4";
        const { publicUrl, storageKey, signedUpload } = await api.media.getUploadUrl(businessId, "VIDEO", ext);

        if (signedUpload) {
          const cloudinaryForm = new FormData();
          cloudinaryForm.append("file", file);
          cloudinaryForm.append("api_key", signedUpload.apiKey);
          cloudinaryForm.append("timestamp", String(signedUpload.timestamp));
          cloudinaryForm.append("signature", signedUpload.signature);
          cloudinaryForm.append("public_id", signedUpload.publicId);
          const cloudinaryRes = await fetch(signedUpload.cloudinaryUploadUrl, { method: "POST", body: cloudinaryForm });
          if (!cloudinaryRes.ok) {
            throw new Error(`Couldn't upload ${file.name}, try again.`);
          }
          await api.media.confirmVideoUpload(businessId, { url: publicUrl, storageKey, durationSeconds });
        } else {
          const formData = new FormData();
          formData.append("file", file);
          await api.media.submit(
            businessId,
            formData,
            `type=VIDEO&url=${encodeURIComponent(publicUrl)}&storageKey=${encodeURIComponent(storageKey)}&durationSeconds=${durationSeconds}`,
          );
        }
        succeeded++;
      } catch (err) {
        lastError = err instanceof ApiError ? err.message : `Couldn't upload ${file.name}.`;
      }
    }

    if (succeeded > 0) {
      showToast(files.length === 1 ? "Video published." : `${succeeded} of ${files.length} videos published.`);
      onChanged();
    }
    if (capHit) {
      setError(`Reached your ${tier} tier's limit of ${videoLimit} videos — ${files.length - succeeded} skipped.`);
    } else if (lastError) {
      setError(lastError);
    }
    setBusyVideos(false);
    e.target.value = "";
  };

  const handleDelete = async (m: Media) => {
    setActionBusy(true);
    try {
      await api.media.remove(businessId, m.id);
      showToast("Deleted.");
      setMenuFor(null);
      onChanged();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete that, try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSetCover = async (m: Media) => {
    setActionBusy(true);
    try {
      await api.businesses.setCoverPhoto(businessId, m.id);
      showToast("Cover photo updated.");
      setMenuFor(null);
      onChanged();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't set that as cover, try again.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="rounded-spotly border border-border bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl text-warm-brown">Gallery</h2>
          <p className="text-sm text-warm-clay">
            {photos.length}/{photoLimit} photos · {videos.length}/{videoLimit} videos
          </p>
        </div>
        <div className="flex gap-2.5">
          <label className={`cursor-pointer rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta ${busyPhotos || photos.length >= photoLimit ? "pointer-events-none opacity-50" : ""}`}>
            {busyPhotos ? "Uploading…" : "Add photos"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoFiles} disabled={busyPhotos || photos.length >= photoLimit} />
          </label>
          <label className={`cursor-pointer rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta ${busyVideos || videos.length >= videoLimit ? "pointer-events-none opacity-50" : ""}`}>
            {busyVideos ? "Checking…" : "Add videos"}
            <input type="file" accept="video/*" multiple className="hidden" onChange={handleVideoFiles} disabled={busyVideos || videos.length >= videoLimit} />
          </label>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-warm-clay">
          No photos or videos yet — add some so your business can be discovered.
        </div>
      ) : (
        // Denser than the public gallery on purpose (more columns, tighter
        // gap) — this is the owner's own compact management view, not the
        // discovery-focused public one.
        <div className="columns-3 gap-1.5 sm:columns-4 md:columns-5">
          {items.map((m, i) => (
            <GalleryTile
              key={m.id}
              media={m}
              isCover={m.id === coverMediaId}
              onOpen={() => setLightboxIndex(i)}
              onLongPress={() => setMenuFor(m)}
            />
          ))}
        </div>
      )}

      {lightboxIndex != null && (
        <Lightbox
          media={items.map((m) => ({ url: m.url, type: m.type }))}
          startIndex={lightboxIndex}
          alt="Gallery"
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {menuFor && (
        <div className="fixed inset-0 z-[350] flex items-end justify-center bg-[rgba(20,15,12,0.5)] sm:items-center" onClick={() => !actionBusy && setMenuFor(null)}>
          <div className="w-full max-w-xs overflow-hidden rounded-t-[24px] bg-surface sm:rounded-[20px]" onClick={(e) => e.stopPropagation()}>
            {menuFor.type === "PHOTO" && menuFor.id !== coverMediaId && (
              <button
                onClick={() => handleSetCover(menuFor)}
                disabled={actionBusy}
                className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left text-sm font-semibold text-text disabled:opacity-60"
              >
                <i className="bi bi-star text-terracotta" /> Use as cover photo
              </button>
            )}
            <button
              onClick={() => handleDelete(menuFor)}
              disabled={actionBusy}
              className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left text-sm font-semibold text-error disabled:opacity-60"
            >
              <i className="bi bi-trash3" /> Delete
            </button>
            <button onClick={() => setMenuFor(null)} className="w-full px-5 py-4 text-center text-sm font-semibold text-warm-clay">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GalleryTile({
  media,
  isCover,
  onOpen,
  onLongPress,
}: {
  media: Media;
  isCover: boolean;
  onOpen: () => void;
  onLongPress: () => void;
}) {
  // A timer-based long-press: starts on press-down, fires onLongPress if
  // still held after LONG_PRESS_MS, cancelled by an early release, the
  // pointer moving too far, OR the page actually scrolling underneath
  // it — that last one is the real fix (Val, Sep 2026: "a small
  // unintentional touch opens the media"). Movement distance alone
  // isn't reliable on tightly packed small tiles: a finger can travel
  // very little sideways while still genuinely mid-scroll. Listening
  // for an actual scroll event while the touch is down catches that
  // case even when the finger barely moved, and cancels the tap-open
  // too, not just the long-press — a scroll happening at all means this
  // was never a deliberate tap on this tile.
  const MOVE_CANCEL_PX = 16;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const cancelledRef = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const onScroll = () => {
    cancelledRef.current = true;
    clear();
  };

  const start = (x: number, y: number) => {
    firedRef.current = false;
    cancelledRef.current = false;
    startPos.current = { x, y };
    window.addEventListener("scroll", onScroll, { passive: true });
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const end = () => {
    clear();
    window.removeEventListener("scroll", onScroll);
    if (!firedRef.current && !cancelledRef.current) onOpen();
  };

  const move = (x: number, y: number) => {
    if (!startPos.current) return;
    const dx = Math.abs(x - startPos.current.x);
    const dy = Math.abs(y - startPos.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      cancelledRef.current = true;
      clear();
    }
  };

  return (
    <button
      type="button"
      onTouchStart={(e) => start(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={end}
      onMouseDown={(e) => start(e.clientX, e.clientY)}
      onMouseMove={(e) => move(e.clientX, e.clientY)}
      onMouseUp={end}
      onMouseLeave={() => {
        clear();
        window.removeEventListener("scroll", onScroll);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="relative mb-1.5 block w-full break-inside-avoid overflow-hidden rounded-lg bg-cream"
    >
      {media.type === "VIDEO" ? (
        <>
          <video src={media.url} muted playsInline preload="metadata" className="block w-full bg-black" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-xs text-white">
              <i className="bi bi-play-fill" />
            </span>
          </span>
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="" loading="lazy" className="block w-full" />
      )}
      {isCover && (
        <span className="absolute left-1 top-1 rounded-full bg-terracotta px-1.5 py-0.5 text-[9px] font-semibold text-white">
          Cover
        </span>
      )}
    </button>
  );
}
