// Business.amenities is a free-form string array in the backend (not an
// enum), so this maps known common values to an icon and falls back to a
// generic checkmark for anything else a business owner types in.
const ICON_MAP: Record<string, string> = {
  "WiFi": "bi-wifi",
  "Parking": "bi-p-circle",
  "Card Payments": "bi-credit-card",
  "Outdoor Seating": "bi-tree",
  "Family Friendly": "bi-emoji-smile",
  "Wheelchair Accessible": "bi-universal-access",
  "Takeaway": "bi-bag-check",
  "Reservations": "bi-calendar-check",
  "Pet Friendly": "bi-heart",
};

export function amenityIcon(label: string): string {
  return ICON_MAP[label] || "bi-check-circle";
}
