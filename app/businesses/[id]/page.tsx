"use client";

import { useEffect, useState, use as usePromise } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BusinessCard } from "@/components/BusinessCard";
import { ExperienceCard } from "@/components/ExperienceCard";
import { ReviewModal } from "@/components/ReviewModal";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/ToastContext";
import { api, ApiError, type Business, type Experience, type ReviewSummary } from "@/lib/api";
import { isAllowedImageUrl } from "@/lib/placeholders";
import { amenityIcon } from "@/lib/amenityIcons";
import { computeOpenStatus, DAYS } from "@/lib/hours";
import { useBookmarks } from "@/components/BookmarksContext";
import { MasonryGallery } from "@/components/MasonryGallery";
import { BusinessDetailSkeleton } from "@/components/Skeleton";

export default function BusinessDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { authed, user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [business, setBusiness] = useState<Business | null>(null);
  const [experienceHistory, setExperienceHistory] = useState<Experience[]>([]);
  const [reviews, setReviews] = useState<ReviewSummary | null>(null);
  const [related, setRelated] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSaved, toggleSave } = useBookmarks();
  const saved = business ? isSaved({ businessId: business.id }) : false;
  const [saveBusy, setSaveBusy] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  // Tabs split "Photos" from "About" so the info (contact, hours,
  // reviews) is reachable immediately rather than buried under a
  // gallery scroll — every tier gets this now, not just paid ones (see
  // the layout branch below for why that changed).
  const [activeTab, setActiveTab] = useState<"photos" | "about">("photos");

  const loadReviews = () => api.reviews.forBusiness(id).then(setReviews);

  useEffect(() => {
    setLoading(true);
    api
      .businesses.get(id)
      .then((b) => {
        setBusiness(b);
        return api.businesses.list({ category: b.categories?.[0] });
      })
      .then((list) => setRelated(list.filter((b) => b.id !== id).slice(0, 6)))
      .catch(() => {
        // A missing or malformed id lands here (business stays null,
        // which the render below already handles with a proper "we
        // couldn't find that business" message) — without this catch,
        // the rejection was unhandled and crashed the whole page with
        // Next's raw error overlay instead of that existing fallback
        // ever getting a chance to render.
      })
      .finally(() => setLoading(false));
    // Full history (upcoming AND past) — business.experiences from the
    // main fetch above only carries whatever the backend happens to
    // include there, which historically was just the live/upcoming set.
    // hostingHistory is the actual complete record (FR-9.4), public,
    // used here so Past Events has real data instead of nothing.
    api.businesses.hostingHistory(id).then(setExperienceHistory).catch(() => {});
    loadReviews().catch(() => {}); // same id maps to no reviews either; the page's own !business branch is what actually matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <>
        <Navbar />
        <BusinessDetailSkeleton />
        <Footer />
      </>
    );
  }

  if (!business) {
    return (
      <>
        <Navbar />
        <div className="px-11 py-24 text-center text-warm-clay">
          We couldn&apos;t find that business. <Link href="/" className="text-terracotta">Back home</Link>
        </div>
        <Footer />
      </>
    );
  }

  const openStatus = computeOpenStatus(business.hours);
  const isOwnBusiness = authed && user?.id === business.ownerId;
  const approvedPhotos = (business.media || []).filter(
    (m) => m.type === "PHOTO" && m.status === "APPROVED" && isAllowedImageUrl(m.url),
  );
  // No stock-photo fallback here anymore — if there's no real media,
  // this is just an empty array, and MasonryGallery renders a plain
  // blank panel instead of any placeholder imagery. Videos interleaved
  // with photos in upload order, not appended after — a real gallery,
  // not photos-plus-an-afterthought.
  const galleryMedia = (business.media || [])
    .filter((m) => m.status === "APPROVED" && (m.type === "VIDEO" || (m.type === "PHOTO" && isAllowedImageUrl(m.url))))
    .map((m) => ({ url: m.url, type: m.type as "PHOTO" | "VIDEO" }));
  const upcomingExperiences = experienceHistory.filter((e) => !e.isExpired);
  const pastExperiences = experienceHistory.filter((e) => e.isExpired);

  const handleSave = async () => {
    if (!authed) return openAuthModal(handleSave);
    if (isOwnBusiness) return showToast("You can't save your own business.");
    setSaveBusy(true);
    try {
      // toggleSave figures out create vs. remove on its own by checking
      // whether this business is already saved — this is what actually
      // makes "unsave" work at all (it never used to: this used to
      // always call create(), Val, Sep 2026).
      const nowSaved = await toggleSave({ businessId: business.id });
      showToast(nowSaved ? "Saved to your collection." : "Removed from your collection.");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't update that, try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: business.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard.");
    }
  };

  const handleDirections = () => {
    const query =
      business.latitude != null && business.longitude != null
        ? `${business.latitude},${business.longitude}`
        : encodeURIComponent(business.address || business.name);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const handleCall = () => {
    if (business.callPhone) {
      window.location.href = `tel:${business.callPhone}`;
    } else {
      showToast("No phone number listed for this business.");
    }
  };

  // wa.me handles the web-vs-app decision itself — on a phone with
  // WhatsApp installed it opens the app, otherwise it falls back to
  // WhatsApp Web, so there's nothing to branch on here beyond making
  // sure the number is digits-only (wa.me rejects "+", spaces, etc.).
  const handleWhatsapp = () => {
    if (business.whatsappPhone) {
      const digits = business.whatsappPhone.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${digits}`, "_blank");
    } else {
      showToast("No WhatsApp number listed for this business.");
    }
  };

  const budgetLabel =
    business.budgetMin != null || business.budgetMax != null
      ? business.budgetMin != null && business.budgetMax != null
        ? `KES ${business.budgetMin.toLocaleString()}–${business.budgetMax.toLocaleString()}`
        : business.budgetMin != null
          ? `From KES ${business.budgetMin.toLocaleString()}`
          : `Up to KES ${business.budgetMax!.toLocaleString()}`
      : null;

  const RESERVATION_LABELS: Record<string, string> = {
    RESERVATION_ONLY: "Reservations only",
    WALK_IN_ONLY: "Walk-ins only",
    BOTH: "Reservations & walk-ins",
  };

  const description = business.description || "This business hasn't added a description yet.";
  const shortDescription = description.length > 220 ? description.slice(0, 220) + "…" : description;

  return (
    <>
      <Navbar />

      {/* GALLERY — Pinterest-style masonry, each photo keeps its own
          natural aspect ratio rather than being cropped into a fixed
          box; tap/click any photo for the full-screen swipe/zoom viewer.
          No floating save button here anymore (Val, Sep 2026: it read
          as ambiguous — save the photo, or the business? — sitting
          directly on top of a photo). Save is a clearly labeled button
          in the action row below instead, next to Call/WhatsApp/Share,
          where there's no photo underneath it to make the target
          unclear. Side padding is tight on mobile specifically so the
          grid reads closer to edge-to-edge, matching the Pinterest
          reference — desktop's spacing is untouched. */}
      {(() => {
        const galleryBlock = (
          <div className="px-11 pt-4 max-md:px-2">
            <MasonryGallery media={galleryMedia} businessName={business.name} />
          </div>
        );

        const nameStatusBlock = (
          <div className="px-11 pt-[26px] max-md:px-4">
            {/* Save moved up next to the name (Val, Sep 2026) — out of
                the Call/WhatsApp/Share row entirely, which now fits
                comfortably in one row on mobile instead of wrapping to
                two. An icon-only button here (no text label) reads
                clearly enough next to the title without needing "Save"
                spelled out, the same way a title-adjacent favorite
                icon works on most listing pages. */}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl text-warm-brown sm:text-[2rem]">{business.name}</h1>
              {isOwnBusiness && (
                <span className="flex items-center gap-1.5 rounded-full bg-[rgba(93,96,65,0.12)] px-3.5 py-1 text-xs font-semibold text-olive">
                  <i className="bi bi-shop" /> This is your business
                </span>
              )}
              {!isOwnBusiness && (
                <button
                  onClick={handleSave}
                  disabled={saveBusy}
                  aria-label={saved ? "Unsave" : "Save"}
                  className={`ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-base transition ${
                    saved
                      ? "border-terracotta bg-terracotta text-white"
                      : "border-border bg-surface hover:border-terracotta hover:text-terracotta"
                  }`}
                >
                  <i className={saved ? "bi bi-heart-fill" : "bi bi-heart"} />
                </button>
              )}
            </div>
            {/* Rating and location only — open/closed status isn't a
                priority here anymore (Val, Sep 2026: already visible on
                the card before someone taps in); it now lives as a
                small badge next to Opening Hours in the About tab
                instead, where it's contextual rather than the first
                thing on the page. Neighborhood is what a Nairobi
                audience actually recognizes, so it's shown ahead of the
                specific street address rather than after it. */}
            <div className="mt-2 flex flex-wrap items-center gap-3.5 text-sm text-warm-clay">
              {reviews && reviews.count > 0 && (
                <span className="flex items-center gap-1 font-bold text-text">
                  <i className="bi bi-star-fill text-gold" /> {reviews.average}{" "}
                  <span className="font-normal text-warm-clay">({reviews.count} reviews)</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <i className="bi bi-geo-alt" /> {business.neighborhood || business.address || "Nairobi"}
              </span>
            </div>

            {/* ACTION ROW — Call, WhatsApp, Share. Directions,
                categories, budget, and reservation policy all moved
                into the About tab (Contact and Details cards) — this
                row's job now is just "the few things someone wants to
                do immediately," not "show everything at once." */}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button onClick={handleCall} className="flex items-center gap-2 rounded-full border border-border bg-surface px-[18px] py-2.5 text-sm font-semibold transition hover:border-terracotta hover:text-terracotta">
                <i className="bi bi-telephone" /> Call
              </button>
              <button onClick={handleWhatsapp} className="flex items-center gap-2 rounded-full border border-border bg-surface px-[18px] py-2.5 text-sm font-semibold transition hover:border-terracotta hover:text-terracotta">
                <i className="bi bi-whatsapp" /> WhatsApp
              </button>
              <button onClick={handleShare} className="flex items-center gap-2 rounded-full border border-border bg-surface px-[18px] py-2.5 text-sm font-semibold transition hover:border-terracotta hover:text-terracotta">
                <i className="bi bi-share" /> Share
              </button>
            </div>
          </div>
        );

        const aboutContentBlock = (
          <>
            {/* MAIN LAYOUT */}
            <div className="grid grid-cols-[1fr_340px] gap-[34px] px-11 pt-[34px] max-md:grid-cols-1 max-md:px-4">
              <div>
                {/* About */}
                <div className="mb-[26px] rounded-spotly border border-border bg-surface p-[26px]">
                  <h2 className="mb-3.5 text-xl text-warm-brown">About</h2>
                  <p className="text-[0.95rem] leading-[1.65]">{aboutExpanded ? description : shortDescription}</p>
                  {description.length > 220 && (
                    <button
                      onClick={() => setAboutExpanded((v) => !v)}
                      className="mt-2 text-sm font-semibold text-terracotta"
                    >
                      {aboutExpanded ? "Read less" : "Read more"}
                    </button>
                  )}
                </div>

                {/* Amenities */}
                {business.amenities.length > 0 && (
                  <div className="mb-[26px] rounded-spotly border border-border bg-surface p-[26px]">
                    <h2 className="mb-3.5 text-xl text-warm-brown">Amenities</h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {business.amenities.map((a) => (
                        <div key={a} className="flex items-center gap-2 text-sm">
                          <i className={`bi ${amenityIcon(a)} text-terracotta`} /> {a}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Experiences */}
                {upcomingExperiences.length > 0 && (
                  <div className="mb-[26px] rounded-spotly border border-border bg-surface p-[26px]">
                    <h2 className="mb-3.5 text-xl text-warm-brown">Upcoming Experiences</h2>
                    <div className="h-scroll flex gap-4 overflow-x-auto">
                      {upcomingExperiences.map((e) => (
                        <ExperienceCard key={e.id} experience={{ ...e, businessName: business.name }} />
                      ))}
                    </div>
                  </div>
                )}

                {pastExperiences.length > 0 && (
                  <div className="mb-[26px] rounded-spotly border border-border bg-surface p-[26px]">
                    <h2 className="mb-3.5 text-xl text-warm-brown">Past Events</h2>
                    <div className="h-scroll flex gap-4 overflow-x-auto">
                      {pastExperiences.map((e) => (
                        <ExperienceCard key={e.id} experience={{ ...e, businessName: business.name }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                <div className="rounded-spotly border border-border bg-surface p-[26px]">
                  <h2 className="mb-3.5 text-xl text-warm-brown">Reviews</h2>
                  {reviews && reviews.count > 0 ? (
                    <>
                      <div className="mb-6 flex flex-wrap items-center gap-6">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-warm-brown">{reviews.average}</div>
                          <div className="text-gold">
                            {"★".repeat(Math.round(reviews.average))}
                            {"☆".repeat(5 - Math.round(reviews.average))}
                          </div>
                          <div className="text-xs text-warm-clay">{reviews.count} reviews</div>
                        </div>
                        <div className="min-w-[220px] flex-1">
                          {[5, 4, 3, 2, 1].map((star) => {
                            const count = reviews.distribution[star - 1];
                            const pct = reviews.count ? Math.round((count / reviews.count) * 100) : 0;
                            return (
                              <div key={star} className="mb-1 flex items-center gap-2 text-xs">
                                <span className="w-2">{star}</span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-6 text-right">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => (isOwnBusiness ? showToast("You cannot review your own business.") : authed ? setReviewModalOpen(true) : openAuthModal(() => setReviewModalOpen(true)))}
                          className="rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white"
                        >
                          Write a Review
                        </button>
                      </div>
                      <div className="space-y-5">
                        {reviews.reviews.map((r) => (
                          <div key={r.id} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
                            <div className="mb-1 flex items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-sm font-semibold text-warm-brown">
                                {r.reviewer.name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-semibold">{r.reviewer.name}</div>
                                <div className="text-xs text-warm-clay">{new Date(r.createdAt).toLocaleDateString()}</div>
                              </div>
                            </div>
                            <div className="mb-1.5 text-gold">
                              {"★".repeat(r.rating)}
                              {"☆".repeat(5 - r.rating)}
                            </div>
                            {r.text && <p className="text-sm">{r.text}</p>}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="mb-4 text-sm text-warm-clay">Be the first to share your experience.</p>
                      <button
                        onClick={() => (isOwnBusiness ? showToast("You cannot review your own business.") : authed ? setReviewModalOpen(true) : openAuthModal(() => setReviewModalOpen(true)))}
                        className="rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white"
                      >
                        Write a Review
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* SIDEBAR */}
              <div>
                <div className="mb-5 rounded-spotly border border-border bg-surface p-5">
                  <h4 className="mb-3 text-base text-warm-brown">Contact</h4>
                  {business.callPhone && (
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <i className="bi bi-telephone text-terracotta" /> {business.callPhone}
                    </div>
                  )}
                  {business.whatsappPhone && (
                    <button
                      onClick={handleWhatsapp}
                      className="mb-2 flex items-center gap-2 text-sm text-terracotta underline"
                    >
                      <i className="bi bi-whatsapp" /> {business.whatsappPhone}
                    </button>
                  )}
                  {business.email && (
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <i className="bi bi-envelope text-terracotta" /> {business.email}
                    </div>
                  )}
                  {business.address && (
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <i className="bi bi-geo-alt text-terracotta" /> {business.address}
                    </div>
                  )}
                  {business.website && (
                    <a
                      href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-terracotta underline"
                    >
                      <i className="bi bi-globe" /> {business.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {!business.callPhone && !business.whatsappPhone && !business.email && !business.address && !business.website && (
                    <p className="text-sm text-warm-clay">This business hasn&apos;t added contact details yet.</p>
                  )}
                  <button
                    onClick={handleDirections}
                    className="mt-3 flex items-center gap-2 rounded-full border border-border bg-cream px-4 py-2 text-sm font-semibold transition hover:border-terracotta hover:text-terracotta"
                  >
                    <i className="bi bi-signpost-2" /> Directions
                  </button>
                </div>

                {/* Categories, budget range and reservation policy — the
                    same fields captured at onboarding/dashboard, moved
                    here from the header (Val, Sep 2026) so the primary
                    mobile view reaches photos sooner; this tab is one
                    tap away for anyone who wants them before deciding. */}
                {(business.categories?.length > 0 || budgetLabel || business.reservationPolicy) && (
                  <div className="mb-5 rounded-spotly border border-border bg-surface p-5">
                    <h4 className="mb-3 text-base text-warm-brown">Details</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {business.categories?.map((cat) => (
                        <span key={cat} className="rounded-full bg-[rgba(93,96,65,0.1)] px-3 py-1 text-xs font-semibold text-olive">
                          {cat}
                        </span>
                      ))}
                      {budgetLabel && (
                        <span className="flex items-center gap-1 rounded-full bg-[rgba(199,101,58,0.1)] px-3 py-1 text-xs font-semibold text-terracotta">
                          <i className="bi bi-cash-stack" /> {budgetLabel}
                        </span>
                      )}
                      {business.reservationPolicy && (
                        <span className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-warm-clay">
                          <i className="bi bi-calendar-check" /> {RESERVATION_LABELS[business.reservationPolicy]}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {business.hours && (
                  <div className="rounded-spotly border border-border bg-surface p-5">
                    <h4 className="mb-3 flex items-center gap-2 text-base text-warm-brown">
                      Opening Hours
                      {openStatus && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            openStatus.open ? "bg-[rgba(93,96,65,0.12)] text-success" : "bg-[rgba(199,101,58,0.1)] text-error"
                          }`}
                        >
                          {openStatus.label}
                        </span>
                      )}
                    </h4>
                    {DAYS.map((day) => {
                      const h = business.hours?.[day];
                      const isToday = day === DAYS[new Date().getDay()];
                      return (
                        <div
                          key={day}
                          className={`flex justify-between py-1.5 text-sm ${isToday ? "font-semibold text-text" : "text-warm-clay"}`}
                        >
                          <span>{day}</span>
                          <span>{h ? `${h.open} – ${h.close}` : "Closed"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RELATED */}
            {related.length > 0 && (
              <div className="px-11 pt-[38px] max-md:px-4">
                <h2 className="mb-4 text-2xl text-warm-brown">Related Businesses</h2>
                <div className="h-scroll flex gap-[18px] overflow-x-auto pb-3.5">
                  {related.map((b) => (
                    <BusinessCard key={b.id} business={b} />
                  ))}
                </div>
              </div>
            )}
          </>
        );

        // Same Photos/About tabbed layout for every tier now — Starter
        // used to get a single continuous scroll instead, on the theory
        // that a 5-photo cap was short enough not to bury the business
        // info below it. That assumption doesn't hold now that the
        // gallery images themselves are bigger/tighter (Val, Sep 2026):
        // even 5 larger photos can push contact/hours/reviews further
        // down than they used to, so every tier gets the same tab
        // switcher rather than only paid ones.
        return (
          <>
            {nameStatusBlock}
            <div className="sticky top-[68px] z-10 mt-6 flex gap-1 border-b border-border bg-cream px-11 max-md:px-4">
              <button
                onClick={() => setActiveTab("photos")}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === "photos" ? "border-terracotta text-terracotta" : "border-transparent text-warm-clay hover:text-text"
                }`}
              >
                <i className="bi bi-images mr-1.5" /> Gallery
              </button>
              <button
                onClick={() => setActiveTab("about")}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === "about" ? "border-terracotta text-terracotta" : "border-transparent text-warm-clay hover:text-text"
                }`}
              >
                <i className="bi bi-info-circle mr-1.5" /> About
              </button>
            </div>
            <div className="pt-6">{activeTab === "photos" ? galleryBlock : aboutContentBlock}</div>
          </>
        );
      })()}

      <div className="h-10" />
      <Footer />

      <ReviewModal
        businessId={business.id}
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onSubmitted={loadReviews}
      />
    </>
  );
}
