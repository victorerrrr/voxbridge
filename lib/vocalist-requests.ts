"use client";

import { getStoredUser } from "@/lib/auth";
import { createProducerOrder, getOrderById, getProducerOrders, type ProducerOrder } from "@/lib/orders";
import { getVocalistProfileByOwnerId } from "@/lib/vocalist-profile";
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
  users?: { username: string } | null;
};

const REQUEST_SELECT = "*, users!vocalist_requests_producer_id_fkey(username)";

function rowToRequest(row: DbRequestRow): VocalistRequest {
  return {
    id: row.id,
    vocalistId: row.vocalist_profile_id,
    producerId: row.producer_id,
    projectName: row.project_name,
    description: row.description,
    brief: row.brief,
    reference: row.reference,
    budget: row.budget,
    producerName: row.users?.username ?? "Producer",
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

export async function getVocalistRequests(): Promise<VocalistRequest[]> {
  const user = await getStoredUser();
  if (!user) return [];
  const { data } = await supabase
    .from("vocalist_requests")
    .select(REQUEST_SELECT)
    .eq("producer_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => rowToRequest(row as unknown as DbRequestRow));
}

export async function getVocalistRequestById(requestId: string): Promise<VocalistRequest | undefined> {
  const { data, error } = await supabase
    .from("vocalist_requests")
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .single();
  if (error || !data) return undefined;
  return rowToRequest(data as unknown as DbRequestRow);
}

export async function getRequestsForVocalist(
  vocalistId: string,
  statuses?: VocalistRequestStatus[]
): Promise<VocalistRequest[]> {
  const allowed = statuses ?? ["pending", "accepted", "declined"];
  const { data } = await supabase
    .from("vocalist_requests")
    .select(REQUEST_SELECT)
    .eq("vocalist_profile_id", vocalistId)
    .in("status", allowed)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => rowToRequest(row as unknown as DbRequestRow));
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
  return rowToRequest(data as unknown as DbRequestRow);
}

async function buildOrderFromRequest(request: VocalistRequest): Promise<ProducerOrder> {
  const user = await getStoredUser();
  const vocalistName = user?.username ?? "Vocalist";
  return createProducerOrder(request.vocalistId, vocalistName, {
    projectName: request.projectName,
    description: request.description,
    reference: request.reference,
    budget: request.budget,
    trackName: request.projectName,
    vibe: request.brief || request.description,
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

  const allOrders = await getProducerOrders();
  return allOrders.find(
    (order) => order.vocalistId === vocalistId && order.status !== "completed"
  );
}

export const vocalistRequestStatusLabel: Record<VocalistRequestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};