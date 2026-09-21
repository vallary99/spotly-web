"use client";

import { useRef, useState } from "react";
import Image from "next/image";

// Val, Sep 2026: "allow user to move the images they upload to be used
// on business cover or event cover, so it can fit and show what they
// prioritize most, not just having a default crop line." This modal
// shows the image at the SAME aspect ratio it's actually displayed at
// (aspectRatio, a CSS aspect-ratio value like "1" or "16/9"), letting
// the person drag to choose what part of the photo stays visible in
// that crop. Pointer events (not separate mouse/touch handlers) so
// this works the same on mobile, where most of Spotly's actual usage
// is.
export function ImageRepositioner({
  imageUrl,
  aspectRatio,
  initialX,
  initialY,
  onSave,
  onClose,
}: {
  imageUrl: string;
  aspectRatio: string;
  initialX: number;
  initialY: number;
  onSave: (x: number, y: number) => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const applyDrag = (clientX: number, clientY: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    // The image itself is larger than the frame (object-fit: cover on
    // an oversized image), so the visible crop moves in the OPPOSITE
    // direction of the pointer's position within the frame -- dragging
    // toward the frame's left edge should reveal more of the image's
    // left side, which is what a falling percentage (closer to 0%)
    // does to object-position's X value.
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setPos({ x, y });
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave(pos.x, pos.y);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(67,53,47,0.6)] p-4">
      <div className="w-full max-w-md rounded-spotly bg-surface p-5">
        <h3 className="mb-1 text-lg text-warm-brown">Reposition photo</h3>
        <p className="mb-3 text-xs text-warm-clay">Drag to choose what shows in the crop.</p>
        <div
          ref={frameRef}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            applyDrag(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => dragging.current && applyDrag(e.clientX, e.clientY)}
          onPointerUp={() => (dragging.current = false)}
          className="relative w-full cursor-move touch-none overflow-hidden rounded-2xl bg-cream select-none"
          style={{ aspectRatio }}
        >
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="400px"
            className="pointer-events-none object-cover"
            style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
            draggable={false}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-border bg-cream py-2.5 text-sm font-semibold">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={busy} className="flex-1 rounded-full bg-terracotta py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "Saving…" : "Save position"}
          </button>
        </div>
      </div>
    </div>
  );
}
