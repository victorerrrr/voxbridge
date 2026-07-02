"use client";

import { supabase } from "@/lib/supabase-client";

export type VocalistReview = {
  id: string;
  orderId: string;
  vocalistId: string;
  producerName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

const listeners = new Set<() => void>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeVocalistReviews(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

type DbReviewRow = {
  id: string;
  order_id: string;
  vocalist_profile_id: string;
  producer_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

async function rowToReview(row: DbReviewRow): Promise<VocalistReview> {
  const { data: producer } = await supabase
    .from("user_public_profile")
    .select("username")
    .eq("id", row.producer_id)
    .single();

  return {
    id: row.id,
    orderId: row.order_id,
    vocalistId: row.vocalist_profile_id,
    producerName: producer?.username ?? "Producer",
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

export async function getVocalistReviews(): Promise<VocalistReview[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return Promise.all((data as DbReviewRow[]).map(rowToReview));
}

export async function getReviewsForVocalist(vocalistId: string): Promise<VocalistReview[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("vocalist_profile_id", vocalistId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return Promise.all((data as DbReviewRow[]).map(rowToReview));
}

export async function getAverageRating(vocalistId: string): Promise<number | null> {
  const reviews = await getReviewsForVocalist(vocalistId);
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export async function addVocalistReview(
  input: Omit<VocalistReview, "id" | "createdAt" | "producerName"> & { producerId: string }
): Promise<VocalistReview> {
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      order_id: input.orderId,
      vocalist_profile_id: input.vocalistId,
      producer_id: input.producerId,
      rating: input.rating,
      comment: input.comment,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("Failed to create review.");
  }

  emitChange();
  return rowToReview(data as DbReviewRow);
}