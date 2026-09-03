import { API_URL } from "./api";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

// Proxied through this app's own backend rather than calling
// OpenStreetMap's Nominatim directly from the browser (Val, Sep 2026:
// addresses like a well-known mall silently didn't geocode). Browsers
// can't set a custom User-Agent on fetch() — Nominatim's usage policy
// asks every request to identify itself that way, and an unidentified
// browser request is liable to get silently rate-limited/blocked. The
// backend has no such restriction and can comply properly — see
// BusinessService.geocodeAddress. Still genuinely free either way,
// this only changes which server makes the actual Nominatim call.
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(`${API_URL}/businesses/geocode?q=${encodeURIComponent(trimmed)}`);
    if (!res.ok) return null;
    const result = await res.json();
    return result ?? null;
  } catch {
    return null;
  }
}

// Straight-line ("as the crow flies") distance in kilometers — not
// driving distance, which would need a routing provider. Plenty for
// "how far is this business from me" at city scale, and needs no
// third-party service at all, just the Haversine formula.
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Wraps the browser's own free Geolocation API in a Promise. Rejects
// with a plain-language reason (permission denied, unsupported, or
// timed out) rather than the raw GeolocationPositionError shape, so
// callers can show it directly.
export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Your browser doesn't support location access."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Location access was denied. You can allow it in your browser's site settings."));
        } else {
          reject(new Error("Couldn't get your location, try again."));
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
