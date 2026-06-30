"use client";

import { getStoredUser } from "@/lib/auth";
import { getUploadContext } from "@/lib/upload-context";
import { supabase } from "@/lib/supabase-client";

export type OrderStatus =
  | "in_progress"
  | "preview_pending"
  | "revision_requested"
  | "preview_approved"
  | "delivery_ready"
  | "completed";

export type ProducerOrder = {
  id: string;
  vocalistId: string;
  vocalistName: string;
  trackName: string;
  vibe: string;
  status: OrderStatus;
  revisionCount: number;
  deliveryNote: string;
  projectName?: string;
  description?: string;
  reference?: string;
  budget?: number;
  producerId: string;
  producerName?: string;
  hasPreview?: boolean;
  hasStems?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderOptions = {
  projectName?: string;
  description?: string;
  reference?: string;
  budget?: number;
  trackName?: string;
  vibe?: string;
};

const listeners = new Set<() => void>();

function emitOrdersChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeProducerOrders(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

type DbOrderRow = {
  id: string;
  vocalist_profile_id: string;
  producer_id: string;
  track_name: string;
  vibe: string;
  status: OrderStatus;
  revision_count: number;
  delivery_note: string;
  project_name: string | null;
  description: string | null;
  reference: string | null;
  budget: number | null;
  has_preview: boolean | null;
  has_stems: boolean | null;
  created_at: string;
  updated_at: string;
  vocalist_profiles?: { users: { username: string } | null } | null;
  users?: { username: string } | null;
};

const ORDER_SELECT =
  "*, vocalist_profiles!orders_vocalist_profile_id_fkey(users!vocalist_profiles_owner_id_fkey(username)), users!orders_producer_id_fkey(username)";

function rowToOrder(row: DbOrderRow): ProducerOrder {
  return {
    id: row.id,
    vocalistId: row.vocalist_profile_id,
    vocalistName: row.vocalist_profiles?.users?.username ?? "Vocalist",
    trackName: row.track_name,
    vibe: row.vibe,
    status: row.status,
    revisionCount: row.revision_count,
    deliveryNote: row.delivery_note,
    projectName: row.project_name ?? undefined,
    description: row.description ?? undefined,
    reference: row.reference ?? undefined,
    budget: row.budget ?? undefined,
    producerId: row.producer_id,
    producerName: row.users?.username ?? undefined,
    hasPreview: row.has_preview ?? false,
    hasStems: row.has_stems ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProducerOrders(): Promise<ProducerOrder[]> {
  const user = await getStoredUser();
  if (!user) return [];
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("producer_id", user.id)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((row) => rowToOrder(row as unknown as DbOrderRow));
}

export async function getOrderById(id: string): Promise<ProducerOrder | undefined> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return rowToOrder(data as unknown as DbOrderRow);
}

export async function getCompletedOrders(): Promise<ProducerOrder[]> {
  const orders = await getProducerOrders();
  return orders.filter((order) => order.status === "completed");
}

export async function getActiveOrders(): Promise<ProducerOrder[]> {
  const orders = await getProducerOrders();
  return orders.filter((order) => order.status !== "completed");
}

export async function createProducerOrder(
  vocalistId: string,
  vocalistName: string,
  options?: CreateOrderOptions
): Promise<ProducerOrder> {
  const user = await getStoredUser();
  if (!user) {
    throw new Error("Cannot create an order without a signed-in producer.");
  }
  const upload = getUploadContext();
  const trackName =
    options?.trackName || options?.projectName || upload?.trackName || "Untitled track";

  const { data, error } = await supabase
    .from("orders")
    .insert({
      vocalist_profile_id: vocalistId,
      producer_id: user.id,
      track_name: trackName,
      vibe:
        options?.vibe || upload?.vibe || upload?.description || options?.description ||
        "No vibe notes",
      status: "in_progress",
      revision_count: 0,
      delivery_note: "",
      project_name: options?.projectName ?? null,
      description: options?.description ?? null,
      reference: options?.reference ?? null,
      budget: options?.budget ?? null,
      has_preview: false,
      has_stems: false,
    })
    .select(ORDER_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create order.");
  }

  emitOrdersChange();
  return rowToOrder(data as unknown as DbOrderRow);
}

export async function updateProducerOrder(
  id: string,
  patch: Partial<
    Pick<ProducerOrder, "status" | "revisionCount" | "deliveryNote" | "hasPreview" | "hasStems">
  >
): Promise<ProducerOrder | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.revisionCount !== undefined) dbPatch.revision_count = patch.revisionCount;
  if (patch.deliveryNote !== undefined) dbPatch.delivery_note = patch.deliveryNote;
  if (patch.hasPreview !== undefined) dbPatch.has_preview = patch.hasPreview;
  if (patch.hasStems !== undefined) dbPatch.has_stems = patch.hasStems;

  const { data, error } = await supabase
    .from("orders")
    .update(dbPatch)
    .eq("id", id)
    .select(ORDER_SELECT)
    .single();

  if (error || !data) return null;
  emitOrdersChange();
  return rowToOrder(data as unknown as DbOrderRow);
}

export async function requestRevision(id: string): Promise<ProducerOrder | null> {
  const order = await getOrderById(id);
  if (!order) return null;
  const isPreviewPhase =
    order.status === "preview_pending" || order.status === "preview_approved";
  return updateProducerOrder(id, {
    status: "revision_requested",
    revisionCount: order.revisionCount + 1,
    deliveryNote: isPreviewPhase
      ? "Preview revision requested — vocalist will upload a new take."
      : "Revision requested — vocalist will re-record selected sections.",
  });
}

export async function submitPreview(id: string): Promise<ProducerOrder | null> {
  return updateProducerOrder(id, {
    status: "preview_pending",
    hasPreview: true,
    deliveryNote: "Preview submitted — waiting for producer approval.",
  });
}

export async function submitRevision(id: string): Promise<ProducerOrder | null> {
  return updateProducerOrder(id, {
    status: "preview_pending",
    hasPreview: true,
    deliveryNote: "Revision uploaded — waiting for producer approval.",
  });
}

export async function approvePreview(id: string): Promise<ProducerOrder | null> {
  return updateProducerOrder(id, {
    status: "preview_approved",
    deliveryNote: "Preview approved — vocalist can deliver final stems.",
  });
}

export async function submitFinalDelivery(id: string): Promise<ProducerOrder | null> {
  return updateProducerOrder(id, {
    status: "delivery_ready",
    hasStems: true,
    deliveryNote: "Final stems delivered — review and approve when ready.",
  });
}

export async function approveDelivery(id: string): Promise<ProducerOrder | null> {
  const order = await getOrderById(id);
  if (!order) return null;
  if (order.status === "preview_pending") {
    return approvePreview(id);
  }
  return updateProducerOrder(id, {
    deliveryNote: "Final stems approved — mark the project complete when ready.",
  });
}

export async function getOrdersForVocalist(vocalistId: string): Promise<ProducerOrder[]> {
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("vocalist_profile_id", vocalistId)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((row) => rowToOrder(row as unknown as DbOrderRow));
}

export async function markOrderCompleted(id: string): Promise<ProducerOrder | null> {
  return updateProducerOrder(id, {
    status: "completed",
    deliveryNote: "Project completed. Files archived in your workspace.",
  });
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  in_progress: "In progress",
  preview_pending: "Waiting for approval",
  revision_requested: "Revision requested",
  preview_approved: "Preview approved",
  delivery_ready: "Delivery ready",
  completed: "Project completed",
};