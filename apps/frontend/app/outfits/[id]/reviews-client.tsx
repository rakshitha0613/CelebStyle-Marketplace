"use client";

import { useState } from "react";
import {
  submitReview,
  markReviewHelpful,
  getStoredToken,
} from "@/lib/api";
import type { Review } from "@/lib/api";

function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  const cls = size === "sm" ? "text-base" : "text-2xl";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type={readOnly ? "button" : "button"}
          disabled={readOnly}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => !readOnly && setHovered(s)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className={`${cls} ${readOnly ? "cursor-default" : "cursor-pointer"} transition`}
        >
          <span className={s <= display ? "text-amber-400" : "text-black/20"}>★</span>
        </button>
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  onHelpful,
}: {
  review: Review;
  onHelpful: (id: string) => void;
}) {
  return (
    <div className="rounded-[16px] border border-black/6 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent uppercase">
              {review.userName.slice(0, 1)}
            </div>
            <div>
              <p className="text-sm font-medium text-primary">{review.userName}</p>
              {review.verified && (
                <span className="text-xs text-green-600">✓ Verified Purchase</span>
              )}
            </div>
          </div>
        </div>
        <StarRating value={review.rating} readOnly size="sm" />
      </div>
      {review.title && (
        <p className="mt-3 text-sm font-medium text-primary">{review.title}</p>
      )}
      <p className="mt-2 text-sm text-text/80 leading-relaxed">{review.body}</p>
      <div className="mt-3 flex items-center gap-4 text-xs text-text/50">
        <span>
          {new Date(review.createdAt).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </span>
        <button
          onClick={() => onHelpful(review.id)}
          className={`flex items-center gap-1 hover:text-accent transition ${review.helpful ? "text-accent" : ""}`}
        >
          👍 Helpful ({review.helpfulCount})
        </button>
      </div>
    </div>
  );
}

export function ReviewsSection({
  outfitId,
  initialReviews,
  initialAverage,
  initialTotal,
}: {
  outfitId: string;
  initialReviews: Review[];
  initialAverage: number | null;
  initialTotal: number;
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [average, setAverage] = useState(initialAverage);
  const [total, setTotal] = useState(initialTotal);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isLoggedIn = !!getStoredToken();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setFormError("Please select a rating."); return; }
    if (!body.trim()) { setFormError("Please write a review."); return; }
    setFormError("");
    setSubmitting(true);
    try {
      const review = await submitReview({ outfitId, rating, title: title.trim(), body: body.trim() });
      setReviews((prev) => [review, ...prev]);
      const newTotal = total + 1;
      const newAvg = average !== null
        ? (average * total + rating) / newTotal
        : rating;
      setTotal(newTotal);
      setAverage(newAvg);
      setSubmitted(true);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    if (!isLoggedIn) return;
    try {
      const result = await markReviewHelpful(reviewId);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, helpful: result.helpful, helpfulCount: result.helpfulCount }
            : r
        )
      );
    } catch { /* ignore */ }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="border-t border-black/6 pt-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Reviews</p>
            <h2 className="mt-2 font-serif text-3xl text-primary">
              Customer Reviews
              {total > 0 && (
                <span className="ml-3 text-xl font-normal text-text/50">({total})</span>
              )}
            </h2>
            {average !== null && (
              <div className="mt-2 flex items-center gap-2">
                <StarRating value={Math.round(average)} readOnly size="md" />
                <span className="text-lg font-medium text-primary">
                  {average.toFixed(1)}
                </span>
                <span className="text-sm text-text/50">out of 5</span>
              </div>
            )}
          </div>
          {isLoggedIn && !submitted && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition"
            >
              Write a Review
            </button>
          )}
          {submitted && (
            <span className="text-sm text-green-600">Review submitted!</span>
          )}
        </div>

        {/* Write review form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-[20px] border border-black/10 bg-white p-6 shadow-sm space-y-4"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Your Review</p>
            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2">
                Rating
              </label>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2">
                Title <span className="normal-case font-normal text-text/40">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarise your experience"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2">
                Review
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="Share your experience with this outfit…"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition"
              >
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(""); }}
                className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary hover:bg-black/5 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Reviews list */}
        {reviews.length === 0 && (
          <div className="text-center py-12 text-text/40">
            <p className="text-3xl mb-3">⭐</p>
            <p className="text-sm">No reviews yet. Be the first to share your experience!</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
          ))}
        </div>
      </div>
    </section>
  );
}
