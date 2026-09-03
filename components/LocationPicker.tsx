"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCurrentPosition } from "@/lib/location";

// Leaflet's default marker icon is loaded via relative image paths
// baked into the package, which most bundlers (Next.js included) can't
// resolve — the marker silently renders as a broken image without this.
// Pointed at a CDN instead of bundling the image files ourselves.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// react-leaflet doesn't recenter the map when `center` changes after
// the initial mount (e.g. a fresh geocode result, or "use my
// location") — this is the standard workaround, a tiny child component
// that reads the live map instance via useMap() and imperatively pans
// it whenever the coordinates prop changes.
function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);
  return null;
}

function DraggableMarker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  return (
    <Marker
      draggable
      position={[latitude, longitude]}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const pos = markerRef.current?.getLatLng();
          if (pos) onChange(pos.lat, pos.lng);
        },
      }}
    />
  );
}

// Zoomed in tight (building-level, not neighborhood-level) on purpose —
// the same real-world drag distance covers much less ground at a close
// zoom, which is what actually makes dragging the pin usable rather
// than fiddly (Val, Sep 2026: "dragging a pin is never that accurate").
const DEFAULT_ZOOM = 17;

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  mapHeightClassName = "h-64",
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  // Lets a modal give this a much taller map than the compact inline
  // usage would want — more usable space directly means more precise
  // dragging, same reasoning as the tight default zoom.
  mapHeightClassName?: string;
}) {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const handleUseMyLocation = async () => {
    setLocating(true);
    setLocateError(null);
    try {
      const pos = await getCurrentPosition();
      onChange(pos.latitude, pos.longitude);
    } catch (err) {
      setLocateError(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  };

  // Default to central Nairobi until there's a real guess (from typing
  // an address, or "use my location") — never a silent, wrong-looking
  // pin on someone's actual building.
  const displayLat = latitude ?? -1.286389;
  const displayLng = longitude ?? 36.817223;

  return (
    <div>
      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={locating}
        className="mb-2 flex items-center gap-2 rounded-full border border-terracotta bg-[rgba(199,101,58,0.08)] px-4 py-2 text-sm font-semibold text-terracotta transition hover:bg-[rgba(199,101,58,0.14)] disabled:opacity-60"
      >
        <i className={`bi ${locating ? "bi-arrow-repeat" : "bi-geo-alt-fill"}`} />
        {locating ? "Finding you…" : "I'm at my business right now — use my location"}
      </button>
      {locateError && <p className="mb-2 text-xs text-error">{locateError}</p>}

      <div className={`${mapHeightClassName} w-full overflow-hidden rounded-2xl border border-border`}>
        <MapContainer
          center={[displayLat, displayLng]}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker latitude={displayLat} longitude={displayLng} onChange={onChange} />
          <Recenter latitude={displayLat} longitude={displayLng} />
        </MapContainer>
      </div>
      <p className="mt-1.5 text-xs text-warm-clay">
        {latitude != null ? "Drag the pin if it's not quite right." : "Type your address above, or use the button to set this automatically."}
      </p>
    </div>
  );
}
