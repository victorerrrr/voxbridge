"use client";

const STORAGE_KEY = "voxbridge_vocalist_reviews";

export type VocalistReview = {
  id: string;
  orderId: string;
  vocalistId: string;
  producerName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

const EMPTY_REVIEWS: VocalistReview[] = [];

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSnapshot: VocalistReview[] = EMPTY_REVIEWS;

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function syncSnapshot(): VocalistReview[] {
  if (typeof window === "undefined") return EMPTY_REVIEWS;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;

  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = EMPTY_REVIEWS;
    return cachedSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as VocalistReview[];
    cachedSnapshot = Array.isArray(parsed) ? parsed : EMPTY_REVIEWS;
  } catch {
    cachedSnapshot = EMPTY_REVIEWS;
  }

  return cachedSnapshot;
}

function readReviews(): VocalistReview[] {
  return [...syncSnapshot()];
}

function writeReviews(reviews: VocalistReview[]): void {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(reviews);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = reviews;
  emitChange();
}

export function subscribeVocalistReviews(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getVocalistReviews(): VocalistReview[] {
  return syncSnapshot();
}

export function getReviewsForVocalist(vocalistId: string): VocalistReview[] {
  return syncSnapshot().filter((review) => review.vocalistId === vocalistId);
}

export function getAverageRating(vocalistId: string): number | null {
  const reviews = getReviewsForVocalist(vocalistId);
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export function addVocalistReview(
  input: Omit<VocalistReview, "id" | "createdAt">
): VocalistReview {
  const review: VocalistReview = {
    ...input,
    id: `rev-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
  const reviews = readReviews();
  reviews.unshift(review);
  writeReviews(reviews);
  return review;
}
