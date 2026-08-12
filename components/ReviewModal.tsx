"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./ToastContext";

export function ReviewModal({
  businessId,
  open,
  onClose,
  onSubmitted,
}: {
  businessId: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Pick a star rating first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.reviews.create(businessId, { rating, text: text.trim() || undefined });
      showToast("Your review has been posted. Thank you!");
      setRating(0);
      setText("");
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post that review, try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[rgba(67,53,47,0.45)] p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-[440px] rounded-[24px] bg-surface p-9 shadow-[0_30px_60px_rgba(0,0,0,0.25)]">
        <button className="absolute top-4 right-4 text-lg text-warm-clay" onClick={onClose} aria-label="Close">
          <i className="bi bi-x-lg" />
        </button>
        <h3 className="mb-1 text-center text-[1.35rem]">Rate &amp; Review</h3>
        <p className="mb-5 text-center text-sm text-warm-clay">Share what stood out about your visit.</p>

        <div className="mb-5 flex justify-center gap-2 text-3xl text-gold">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onMouseEnter={() => setHoverRating(v)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(v)}
              aria-label={`${v} star${v > 1 ? "s" : ""}`}
            >
              <i className={v <= (hoverRating || rating) ? "bi bi-star-fill" : "bi bi-star"} />
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="What did you love? What should other visitors know?"
          className="mb-3 w-full rounded-2xl border border-border bg-cream px-4 py-3 text-sm outline-none focus:border-terracotta"
        />
        {error && <p className="mb-3 text-sm text-error">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full rounded-full bg-terracotta py-3 text-sm font-semibold text-white transition hover:bg-[#b5572f] disabled:opacity-60"
        >
          {busy ? "Posting…" : "Post Review"}
        </button>
      </div>
    </div>
  );
}
