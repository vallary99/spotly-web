// Structured as city -> neighborhoods so adding a new launch city later
// (Kisumu, Mombasa, etc.) is just a new entry here plus setting
// Business.city on new listings — no schema change needed, since city
// and neighborhood are already separate fields on the backend.
//
// Nairobi's list includes both the dense inner neighborhoods the MVP
// PRD scopes the launch to (Westlands, Kilimani, CBD) and the wider
// metro area residents commonly think of as "Nairobi" (Karen, Ngong,
// Ruaka, Athi River, etc.) — useful for search/browse even before
// those areas have their own dedicated business density.
export const LOCATIONS_BY_CITY: Record<string, string[]> = {
  Nairobi: [
    "Westlands",
    "Kilimani",
    "CBD",
    "Karen",
    "Lavington",
    "Kileleshwa",
    "Parklands",
    "Eastleigh",
    "South B",
    "South C",
    "Langata",
    "Embakasi",
    "Kasarani",
    "Kahawa",
    "Ruaka",
    "Ngong",
    "Rongai",
    "Athi River",
    "Kitengela",
    "Ruiru",
    "Runda",
    "Gigiri",
  ],
  // Placeholder for a future launch city — demonstrates the pattern.
  // Not currently selectable in the UI (see CITIES below) since the MVP
  // is explicitly scoped to Nairobi only (BRD Section 11).
  Kisumu: ["Milimani", "CBD", "Nyalenda", "Mamboleo", "Kondele", "Tom Mboya"],
};

// Only Nairobi is live for the MVP launch. When a second city is ready,
// add it here — everything else (dropdowns, filters, backend queries)
// already reads from LOCATIONS_BY_CITY dynamically.
export const CITIES = ["Nairobi"];
