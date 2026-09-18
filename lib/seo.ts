import type { Business } from "./api";

// Val, Sep 2026 SEO spec, Section 6: "Use the most specific appropriate
// LocalBusiness subtype... Do not incorrectly label businesses just to
// obtain a specific schema type." Only covers Spotly's actual seeded
// categories that map cleanly onto a real Schema.org type — anything
// not listed here correctly falls back to generic LocalBusiness rather
// than being forced into a wrong-but-specific type.
const CATEGORY_TO_SCHEMA_TYPE: Record<string, string> = {
  Cafe: "CafeOrCoffeeShop",
  Bakery: "Bakery",
  Diner: "Restaurant",
  Buffet: "Restaurant",
  Brewery: "BarOrPub",
  "Cocktail Bar": "BarOrPub",
  "Karaoke Bar": "BarOrPub",
  "Late-Night Venue": "NightClub",
  "Art Gallery": "ArtGallery",
  "Art Studio": "ArtGallery",
  Boutique: "ClothingStore",
  "Antique Store": "Store",
  "Climbing Gym": "ExerciseGym",
  "Esports Venue": "ExerciseGym",
  "Ice Skating Rink": "IceSkatingRink",
  "Camping Site": "CampingPitch",
  "Cultural Centre": "TouristAttraction",
  "Heritage Site": "TouristAttraction",
  "Exhibition Space": "TouristAttraction",
  "Farmers Market": "Store",
};

function resolveSchemaType(categories: string[]): string {
  for (const c of categories) {
    if (CATEGORY_TO_SCHEMA_TYPE[c]) return CATEGORY_TO_SCHEMA_TYPE[c];
  }
  // A bare "Restaurant"/"Bar"/"Hotel"/etc. category name is already a
  // valid Schema.org type as-is.
  const KNOWN_DIRECT = ["Restaurant", "Bar", "Hotel", "Museum", "NightClub", "Store", "Gym"];
  for (const c of categories) {
    if (KNOWN_DIRECT.includes(c)) return c === "Bar" ? "BarOrPub" : c === "Gym" ? "ExerciseGym" : c;
  }
  return "LocalBusiness";
}

const DAY_TO_SCHEMA: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

// Section 23: a single reusable function fed the actual business
// object, rather than hand-writing schema per business. Only includes
// properties that are actually known — never invents addresses, hours,
// phone numbers, ratings, or reviews (Section 6, Section 19).
export function generateBusinessSchema(business: Business, photoUrl: string | null, canonicalUrl: string): Record<string, unknown> {
  const openingHoursSpecification =
    business.hours && Object.keys(business.hours).length > 0
      ? Object.entries(business.hours)
          .filter(([, v]) => v)
          .map(([day, v]) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: DAY_TO_SCHEMA[day.toLowerCase()] ?? day,
            opens: v!.open,
            closes: v!.close,
          }))
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": resolveSchemaType(business.categories || []),
    name: business.name,
    description: business.description || undefined,
    image: photoUrl || undefined,
    address: business.address
      ? { "@type": "PostalAddress", streetAddress: business.address, addressLocality: business.neighborhood || "Nairobi", addressCountry: "KE" }
      : undefined,
    telephone: business.callPhone || undefined,
    url: canonicalUrl,
    ...(business.latitude != null && business.longitude != null
      ? { geo: { "@type": "GeoCoordinates", latitude: business.latitude, longitude: business.longitude } }
      : {}),
    openingHoursSpecification,
    // Section 17: only the business's own verified fields — website is
    // the only such field Spotly actually collects today. Never
    // guessing at Instagram/Facebook URLs that aren't in the data.
    sameAs: business.website ? [business.website.startsWith("http") ? business.website : `https://${business.website}`] : undefined,
  };
}

// Section 12: a business reachable by direct link but not yet meeting
// the public discoverability bar (BusinessService.applyListingFilters)
// shouldn't be indexed, even though the page itself still renders for
// whoever has the link (e.g., the owner previewing their own listing,
// or a Made in Kenya application still pending review).
export function isIndexable(business: Business): boolean {
  return business.approvalStatus === undefined || business.approvalStatus === "APPROVED";
}
