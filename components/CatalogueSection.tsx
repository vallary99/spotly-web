"use client";

import { useEffect, useState } from "react";
import { api, type Product } from "@/lib/api";
import { useToast } from "./ToastContext";

// Renders inside the business detail page's "Catalogue" tab (Made in
// Kenya businesses only). Deliberately not a separate page per product
// — sharing works via a query param on this same business page instead
// (Val, Sep 2026: "Is there a way to share a product without having a
// dedicated page for it?"), which BusinessDetailClient reads on load to
// auto-open the right product here.
export function CatalogueSection({
  businessId,
  businessPath,
  autoOpenProductId,
}: {
  businessId: string;
  businessPath: string;
  autoOpenProductId?: string | null;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Product | null>(null);

  useEffect(() => {
    api.products.listForBusiness(businessId).then((list) => {
      setProducts(list);
      if (autoOpenProductId) {
        const match = list.find((p) => p.id === autoOpenProductId);
        if (match) setViewing(match);
      }
    }).catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  if (loading) return <p className="py-8 text-center text-warm-clay">Loading…</p>;
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-warm-clay">
        No products yet. Check back soon.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {products.map((p) => (
          <button key={p.id} onClick={() => setViewing(p)} className="text-left">
            <div className="mb-1.5 aspect-square overflow-hidden rounded-2xl bg-cream">
              {p.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <p className="truncate text-sm font-semibold text-text">{p.name}</p>
            <p className="text-xs text-terracotta">{p.currency} {p.price?.toLocaleString() ?? "Not set"}</p>
          </button>
        ))}
      </div>

      {viewing && (
        <ProductViewer
          businessId={businessId}
          businessPath={businessPath}
          product={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

function ProductViewer({
  businessId,
  businessPath,
  product,
  onClose,
}: {
  businessId: string;
  businessPath: string;
  product: Product;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [idx, setIdx] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const images = product.images;

  // Registers a real history entry so the back button/gesture closes
  // this viewer instead of leaving the business page entirely — same
  // fix, same reasoning, as the Lightbox's own history handling.
  useEffect(() => {
    window.history.pushState({ productViewer: true }, "");
    const onPopState = () => onClose();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleClose = () => window.history.back();

  const goTo = (next: number) => {
    if (next < 0 || next >= images.length) return;
    setIdx(next);
  };
  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 40) goTo(delta < 0 ? idx + 1 : idx - 1);
    setTouchStartX(null);
  };

  const handleShare = async () => {
    // The deep link — same page, ?product= tells BusinessDetailClient
    // to open the Catalogue tab and this exact product on load.
    const url = `${window.location.origin}${businessPath}?product=${product.id}`;
    api.businesses.recordShare(businessId);
    if (navigator.share) {
      navigator.share({ title: product.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard.");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-spotly bg-surface">
        <div className="relative">
          {images.length > 0 ? (
            <div className="aspect-square overflow-hidden bg-cream" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[idx].url} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-cream text-warm-clay"><i className="bi bi-image text-3xl" /></div>
          )}
          <button onClick={handleClose} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white" aria-label="Close">
            <i className="bi bi-x-lg" />
          </button>
          {images.length > 1 && (
            <>
              <button onClick={() => goTo(idx - 1)} disabled={idx === 0} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-warm-brown disabled:opacity-0">
                <i className="bi bi-chevron-left" />
              </button>
              <button onClick={() => goTo(idx + 1)} disabled={idx === images.length - 1} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-warm-brown disabled:opacity-0">
                <i className="bi bi-chevron-right" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {images.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`} />)}
              </div>
            </>
          )}
        </div>
        <div className="p-5">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-warm-brown">{product.name}</h3>
            <button onClick={handleShare} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border" aria-label="Share">
              <i className="bi bi-share" />
            </button>
          </div>
          <p className="mb-3 font-semibold text-terracotta">{product.currency} {product.price?.toLocaleString() ?? "Not set"}</p>
          {product.description && <p className="text-sm text-text">{product.description}</p>}
        </div>
      </div>
    </div>
  );
}
