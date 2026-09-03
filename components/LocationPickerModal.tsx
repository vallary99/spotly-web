"use client";

import { LocationPicker } from "./LocationPicker";

// Popup rather than inline (Val, Sep 2026) — two real reasons, not just
// tidiness: it keeps the surrounding form from permanently growing by
// a map's worth of scroll, and a much bigger map here means more
// precise dragging than a small inline one could, the same reasoning
// behind the tight default zoom in LocationPicker itself. Closes on
// either the X or "Done" — there's no separate confirm step needed
// since the pin's position already updates live via onChange on every
// drag, same as it always did; this just controls visibility.
export function LocationPickerModal({
  latitude,
  longitude,
  onChange,
  onClose,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-[rgba(20,15,12,0.55)] sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface sm:max-w-lg sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-warm-brown">Set your location</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-warm-clay transition hover:bg-cream"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <LocationPicker latitude={latitude} longitude={longitude} onChange={onChange} mapHeightClassName="h-[55vh] sm:h-[420px]" />
        </div>
        <div className="border-t border-border p-4">
          <button onClick={onClose} className="w-full rounded-full bg-terracotta py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
