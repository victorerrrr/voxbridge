"use client";

import { getStoredUser } from "@/lib/auth";
import { createProducerOrder, getOrderById, getProducerOrders, type ProducerOrder } from "@/lib/orders";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";

const STORAGE_KEY = "voxbridge_vocalist_requests";

export type VocalistRequestStatus = "pending" | "accepted" | "declined";

export type VocalistRequestReferenceLink = {
  label: string;
  url: string;
};

export type VocalistRequest = {
  id: string;
  vocalistId: string;
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

const EMPTY_REQUESTS: VocalistRequest[] = [];

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSnapshot: VocalistRequest[] = EMPTY_REQUESTS;

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function normalizeRequest(raw: Partial<VocalistRequest> & Pick<VocalistRequest, "id" | "vocalistId" | "projectName" | "status" | "createdAt">): VocalistRequest {
  return {
    id: raw.id,
    vocalistId: raw.vocalistId,
    projectName: raw.projectName,
    description: raw.description ?? "",
    brief: raw.brief ?? raw.description ?? "",
    reference: raw.reference ?? "",
    budget: raw.budget ?? 0,
    producerName: raw.producerName ?? "Producer",
    status: raw.status,
    createdAt: raw.createdAt,
    orderId: raw.orderId,
    genreTags: raw.genreTags ?? [],
    moodTags: raw.moodTags ?? [],
    voiceTags: raw.voiceTags ?? [],
    bpm: raw.bpm ?? "",
    musicalKey: raw.musicalKey ?? "",
    referenceLinks: raw.referenceLinks ?? [],
    deadline: raw.deadline ?? "",
  };
}

function syncSnapshot(): VocalistRequest[] {
  if (typeof window === "undefined") return EMPTY_REQUESTS;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;

  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = EMPTY_REQUESTS;
    return cachedSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VocalistRequest>[];
    cachedSnapshot = Array.isArray(parsed)
      ? parsed.map((item) => normalizeRequest(item as VocalistRequest))
      : EMPTY_REQUESTS;
  } catch {
    cachedSnapshot = EMPTY_REQUESTS;
  }

  return cachedSnapshot;
}

function readRequests(): VocalistRequest[] {
  return [...syncSnapshot()];
}

function writeRequests(requests: VocalistRequest[]): void {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(requests);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = requests;
  emitChange();
}

export function subscribeVocalistRequests(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getVocalistRequests(): VocalistRequest[] {
  return syncSnapshot();
}

export function getVocalistRequestById(requestId: string): VocalistRequest | undefined {
  return syncSnapshot().find((request) => request.id === requestId);
}

export function getRequestsForVocalist(
  vocalistId: string,
  statuses?: VocalistRequestStatus[]
): VocalistRequest[] {
  const allowed = statuses ?? ["pending", "accepted", "declined"];
  return syncSnapshot()
    .filter((request) => request.vocalistId === vocalistId && allowed.includes(request.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getPendingRequestsForVocalist(vocalistId: string): VocalistRequest[] {
  return getRequestsForVocalist(vocalistId, ["pending"]);
}

function createRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const MOCK_REQUESTS: Omit<VocalistRequest, "id" | "vocalistId" | "createdAt">[] = [
  {
    projectName: "Midnight Drive",
    description: "Need a husky male topline for an afro-house drop. 8-bar hook + ad-libs.",
    brief:
      "Match the AI reference energy in the hook. Keep the delivery intimate on the verse, then open up on the drop. Light doubles on the last 4 bars.",
    reference: "ai-reference-midnight.mp3",
    budget: 220,
    producerName: "Kai Beats",
    status: "pending",
    genreTags: ["Afro House", "Melodic House"],
    moodTags: ["Euphoric", "Dark"],
    voiceTags: ["Husky", "Male", "Topline"],
    bpm: "124",
    musicalKey: "F# minor",
    referenceLinks: [
      { label: "Suno preview", url: "https://suno.com/mock/midnight-drive" },
      { label: "Spotify ref", url: "https://open.spotify.com/track/mock-midnight" },
    ],
    deadline: "May 28, 2026",
  },
  {
    projectName: "Neon Tears",
    description: "Emotional cinematic vocal for indie electronic bridge section.",
    brief:
      "Cinematic, breathy tone for a bridge lift. Producer wants a vulnerable first pass, then a fuller stacked chorus double.",
    reference: "neon-tears-demo.wav",
    budget: 180,
    producerName: "Lena Wave",
    status: "pending",
    genreTags: ["Indie", "Cinematic"],
    moodTags: ["Emotional", "Dreamy"],
    voiceTags: ["Breathy", "Female", "Falsetto"],
    bpm: "92",
    musicalKey: "D major",
    referenceLinks: [{ label: "YouTube sketch", url: "https://youtube.com/watch?v=mock-neon-tears" }],
    deadline: "Jun 2, 2026",
  },
];

function seedMockRequestsIfNeeded(vocalistId: string): void {
  const existing = readRequests().filter((r) => r.vocalistId === vocalistId);
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const seeded = MOCK_REQUESTS.map((item) => ({
    ...item,
    id: createRequestId(),
    vocalistId,
    createdAt: now,
  }));

  writeRequests([...readRequests(), ...seeded]);
}

export function ensureVocalistRequestsSeeded(): void {
  const user = getStoredUser();
  if (!user || user.role !== "vocalist") return;
  seedMockRequestsIfNeeded(vocalistIdFromEmail(user.email));
}

function buildOrderFromRequest(request: VocalistRequest): ProducerOrder {
  const user = getStoredUser();
  const vocalistName = user?.username ?? "Vocalist";

  return createProducerOrder(request.vocalistId, vocalistName, {
    projectName: request.projectName,
    description: request.description,
    reference: request.reference,
    budget: request.budget,
    producerName: request.producerName,
    trackName: request.projectName,
    vibe: request.brief || request.description,
  });
}

export function acceptVocalistRequest(requestId: string): ProducerOrder | null {
  const requests = readRequests();
  const index = requests.findIndex((r) => r.id === requestId);
  if (index === -1) return null;

  const request = requests[index];

  if (request.status === "accepted") {
    if (request.orderId) {
      const existing = getOrderById(request.orderId);
      if (existing) return existing;
    }
    const order = buildOrderFromRequest(request);
    requests[index] = { ...request, orderId: order.id };
    writeRequests(requests);
    return order;
  }

  if (request.status !== "pending") return null;

  const order = buildOrderFromRequest(request);
  requests[index] = { ...request, status: "accepted", orderId: order.id };
  writeRequests(requests);

  return order;
}

export function declineVocalistRequest(requestId: string): void {
  const requests = readRequests();
  const index = requests.findIndex((r) => r.id === requestId);
  if (index === -1) return;
  if (requests[index].status === "declined") return;
  requests[index] = { ...requests[index], status: "declined" };
  writeRequests(requests);
}

export function getActiveVocalistOrder(): ProducerOrder | undefined {
  const user = getStoredUser();
  if (!user || user.role !== "vocalist") return undefined;
  const vocalistId = vocalistIdFromEmail(user.email);

  const acceptedRequests = syncSnapshot()
    .filter((r) => r.vocalistId === vocalistId && r.status === "accepted" && r.orderId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const request of acceptedRequests) {
    const linked = getOrderById(request.orderId!);
    if (linked && linked.status !== "completed") return linked;
  }

  return getProducerOrders().find(
    (order) => order.vocalistId === vocalistId && order.status !== "completed"
  );
}

export const vocalistRequestStatusLabel: Record<VocalistRequestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};
