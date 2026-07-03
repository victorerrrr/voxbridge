"use client";

import { getStoredUser } from "@/lib/auth";
import { createProducerOrder, getOrderById, getOrdersForVocalist, type ProducerOrder } from "@/lib/orders";
import {
  getVocalistProfileById,
  getVocalistProfileByOwnerId,
} from "@/lib/vocalist-profile";
import { supabase } from "@/lib/supabase-client";

export type VocalistRequestStatus = "pending" | "accepted" | "declined";

export type VocalistRequestReferenceLink = {
  label: string;
  url: string;
};

export type VocalistRequest = {
  id: string;
  vocalistId: string;
  producerId: string;
  projectName: string;
  description: string;
  brief: string;
  reference: string;
  budget: number;
  producerName: string;
  status: VocalistRequestStatus;
  createdAt: string;
  orderId?: string;
  genreTags: string[];
  moodTags: string[];
  voiceTags: string[];
  bpm: string;
  musicalKey: string;
  referenceLinks: VocalistRequestReferenceLink[];
  deadline: string;
};

const listeners = new Set<() => void>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeVocalistRequests(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

type DbRequestRow = {
  id: string;
  vocalist_profile_id: string;
  producer_id: string;
  project_name: string;
  description: string;
  brief: string;
  reference: string;
  budget: number;
  status: VocalistRequestStatus;
  genre_tags: string[];
  mood_tags: string[];
  voice_tags: string[];
  bpm: string;
  musical_key: string;
  reference_links: VocalistRequestReferenceLink[];
  deadline: string | null;
  order_id: string | null;
  created_at: string;
};

const REQUEST_SELECT = "*";

async function lookupProducerUsername(producerId: string): Promise<string> {
  const { data } = await supabase
    .from("user_public_profile")
    .select("username")
    .eq("id", producerId)
    .maybeSingle();
  return data?.username ?? "Producer";
}

function rowToRequest(row: DbRequestRow, producerName: string): VocalistRequest {
  return {
    id: row.id,
    vocalistId: row.vocalist_profile_id,
    producerId: row.producer_id,
    projectName: row.project_name,
    description: row.description,
    brief: row.brief,
    reference: row.reference,
    budget: row.budget,
    producerName,
    status: row.status,
    createdAt: row.created_at,
    orderId: row.order_id ?? undefined,
    genreTags: row.genre_tags ?? [],
    moodTags: row.mood_tags ?? [],
    voiceTags: row.voice_tags ?? [],
    bpm: row.bpm,
    musicalKey: row.musical_key,
    referenceLinks: row.reference_links ?? [],
    deadline: row.deadline ?? "",
  };
}

async function enrichRequests(rows: DbRequestRow[]): Promise<VocalistRequest[]> {
  const names = new Map<string, string>();
  const uniqueProducerIds = [...new Set(rows.map((row) => row.producer_id))];
  await Promise.all(
    uniqueProducerIds.map(async (producerId) => {
      names.set(producerId, await lookupProducerUsername(producerId));
    })
  );
  return rows.map((row) => rowToRequest(row, names.get(row.producer_id) ?? "Producer"));
}

export async function getVocalistRequests(): Promise<VocalistRequest[]> {
  const user = await getStoredUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("vocalist_requests")
    .select(REQUEST_SELECT)
    .eq("producer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[vocalist-requests] getVocalistRequests:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => rowToRequest(row as DbRequestRow, user.username));
}

export async function getVocalistRequestById(requestId: string): Promise<VocalistRequest | undefined> {
  const { data, error } = await supabase
    .from("vocalist_requests")
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .single();
  if (error || !data) return undefined;
  const row = data as DbRequestRow;
  const producerName = await lookupProducerUsername(row.producer_id);
  return rowToRequest(row, producerName);
}

export async function getRequestsForVocalist(
  vocalistId: string,
  statuses?: VocalistRequestStatus[]
): Promise<VocalistRequest[]> {
  const allowed = statuses ?? ["pending", "accepted", "declined"];
  const { data, error } = await supabase
    .from("vocalist_requests")
    .select(REQUEST_SELECT)
    .eq("vocalist_profile_id", vocalistId)
    .in("status", allowed)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[vocalist-requests] getRequestsForVocalist:", error.message);
    return [];
  }
  return enrichRequests((data ?? []) as DbRequestRow[]);
}

export async function getPendingRequestsForVocalist(vocalistId: string): Promise<VocalistRequest[]> {
  return getRequestsForVocalist(vocalistId, ["pending"]);
}

export type CreateVocalistRequestOptions = {
  projectName: string;
  description?: string;
  brief?: string;
  reference?: string;
  budget?: number;
  genreTags?: string[];
  moodTags?: string[];
  voiceTags?: string[];
  bpm?: string;
  musicalKey?: string;
  referenceLinks?: VocalistRequestReferenceLink[];
  deadline?: string;
};

export async function createVocalistRequest(
  vocalistId: string,
  options: CreateVocalistRequestOptions
): Promise<VocalistRequest> {
  const user = await getStoredUser();
  if (!user) {
    throw new Error("Cannot send a request without a signed-in producer.");
  }
  const { data, error } = await supabase
    .from("vocalist_requests")
    .insert({
      vocalist_profile_id: vocalistId,
      producer_id: user.id,
      project_name: options.projectName,
      description: options.description ?? "",
      brief: options.brief ?? options.description ?? "",
      reference: options.reference ?? "",
      budget: options.budget ?? 0,
      status: "pending",
      genre_tags: options.genreTags ?? [],
      mood_tags: options.moodTags ?? [],
      voice_tags: options.voiceTags ?? [],
      bpm: options.bpm ?? "",
      musical_key: options.musicalKey ?? "",
      reference_links: options.referenceLinks ?? [],
      deadline: options.deadline ?? null,
    })
    .select(REQUEST_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create vocalist request.");
  }
  emitChange();
  return rowToRequest(data as DbRequestRow, user.username);
}

async function buildOrderFromRequest(request: VocalistRequest): Promise<ProducerOrder> {
  const profile = await getVocalistProfileById(request.vocalistId);
  const vocalistName = profile?.username ?? "Vocalist";
  return createProducerOrder(request.vocalistId, vocalistName, {
    projectName: request.projectName,
    description: request.description,
    reference: request.reference,
    budget: request.budget,
    trackName: request.projectName,
    vibe: request.brief || request.description,
    producerId: request.producerId,
  });
}

export async function acceptVocalistRequest(requestId: string): Promise<ProducerOrder | null> {
  const request = await getVocalistRequestById(requestId);
  if (!request) return null;

  if (request.status === "accepted") {
    if (request.orderId) {
      const existing = await getOrderById(request.orderId);
      if (existing) return existing;
    }
    const order = await buildOrderFromRequest(request);
    await supabase.from("vocalist_requests").update({ order_id: order.id }).eq("id", requestId);
    emitChange();
    return order;
  }

  if (request.status !== "pending") return null;

  const order = await buildOrderFromRequest(request);
  await supabase
    .from("vocalist_requests")
    .update({ status: "accepted", order_id: order.id })
    .eq("id", requestId);
  emitChange();
  return order;
}

export async function declineVocalistRequest(requestId: string): Promise<void> {
  await supabase
    .from("vocalist_requests")
    .update({ status: "declined" })
    .eq("id", requestId)
    .eq("status", "pending");
  emitChange();
}

export async function getActiveVocalistOrder(): Promise<ProducerOrder | undefined> {
  const user = await getStoredUser();
  if (!user || user.role !== "vocalist") return undefined;
  const profile = await getVocalistProfileByOwnerId(user.id);
  if (!profile) return undefined;
  const vocalistId = profile.id;

  const acceptedRequests = await getRequestsForVocalist(vocalistId, ["accepted"]);
  const withOrder = acceptedRequests
    .filter((r) => r.orderId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const request of withOrder) {
    const linked = await getOrderById(request.orderId!);
    if (linked && linked.status !== "completed") return linked;
  }

  const vocalistOrders = await getOrdersForVocalist(vocalistId);
  return vocalistOrders.find((order) => order.status !== "completed");
}

export const vocalistRequestStatusLabel: Record<VocalistRequestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};
