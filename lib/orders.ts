"use client";

import { getUploadContext } from "@/lib/upload-context";

const STORAGE_KEY = "voxbridge_producer_orders";

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
  producerName?: string;
  trackName?: string;
  vibe?: string;
};

const EMPTY_ORDERS: ProducerOrder[] = [];

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSnapshot: ProducerOrder[] = EMPTY_ORDERS;

function sortOrders(orders: ProducerOrder[]): ProducerOrder[] {
  return [...orders].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function syncOrdersSnapshot(): ProducerOrder[] {
  if (typeof window === "undefined") return EMPTY_ORDERS;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;

  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = EMPTY_ORDERS;
    return cachedSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as ProducerOrder[];
    const list = Array.isArray(parsed) ? parsed : [];
    cachedSnapshot = list.length === 0 ? EMPTY_ORDERS : sortOrders(list);
  } catch {
    cachedSnapshot = EMPTY_ORDERS;
  }

  return cachedSnapshot;
}

function emitOrdersChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeProducerOrders(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function readOrders(): ProducerOrder[] {
  return [...syncOrdersSnapshot()];
}

function writeOrders(orders: ProducerOrder[]): void {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(orders);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = orders.length === 0 ? EMPTY_ORDERS : sortOrders(orders);
  emitOrdersChange();
}

export function getProducerOrders(): ProducerOrder[] {
  return syncOrdersSnapshot();
}

export function getOrderById(id: string): ProducerOrder | undefined {
  return syncOrdersSnapshot().find((order) => order.id === id);
}

export function getCompletedOrders(): ProducerOrder[] {
  return getProducerOrders().filter((order) => order.status === "completed");
}

export function getActiveOrders(): ProducerOrder[] {
  return getProducerOrders().filter((order) => order.status !== "completed");
}

function createOrderId(): string {
  return `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createProducerOrder(
  vocalistId: string,
  vocalistName: string,
  options?: CreateOrderOptions
): ProducerOrder {
  const upload = getUploadContext();
  const now = new Date().toISOString();
  const trackName =
    options?.trackName || options?.projectName || upload?.trackName || "Untitled track";
  const order: ProducerOrder = {
    id: createOrderId(),
    vocalistId,
    vocalistName,
    trackName,
    vibe: options?.vibe || upload?.vibe || upload?.description || options?.description || "No vibe notes",
    status: "in_progress",
    revisionCount: 0,
    deliveryNote: "",
    projectName: options?.projectName,
    description: options?.description,
    reference: options?.reference,
    budget: options?.budget,
    producerName: options?.producerName,
    hasPreview: false,
    hasStems: false,
    createdAt: now,
    updatedAt: now,
  };

  const orders = readOrders();
  orders.unshift(order);
  writeOrders(orders);
  return order;
}

export function updateProducerOrder(
  id: string,
  patch: Partial<
    Pick<
      ProducerOrder,
      "status" | "revisionCount" | "deliveryNote" | "hasPreview" | "hasStems"
    >
  >
): ProducerOrder | null {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === id);
  if (index === -1) return null;

  const updated: ProducerOrder = {
    ...orders[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  orders[index] = updated;
  writeOrders(orders);
  return updated;
}

export function requestRevision(id: string): ProducerOrder | null {
  const order = getOrderById(id);
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

export function submitPreview(id: string): ProducerOrder | null {
  return updateProducerOrder(id, {
    status: "preview_pending",
    hasPreview: true,
    deliveryNote: "Preview submitted — waiting for producer approval.",
  });
}

export function submitRevision(id: string): ProducerOrder | null {
  return updateProducerOrder(id, {
    status: "preview_pending",
    hasPreview: true,
    deliveryNote: "Revision uploaded — waiting for producer approval.",
  });
}

export function approvePreview(id: string): ProducerOrder | null {
  return updateProducerOrder(id, {
    status: "preview_approved",
    deliveryNote: "Preview approved — vocalist can deliver final stems.",
  });
}

export function submitFinalDelivery(id: string): ProducerOrder | null {
  return updateProducerOrder(id, {
    status: "delivery_ready",
    hasStems: true,
    deliveryNote: "Final stems delivered — review and approve when ready.",
  });
}

export function approveDelivery(id: string): ProducerOrder | null {
  const order = getOrderById(id);
  if (!order) return null;
  if (order.status === "preview_pending") {
    return approvePreview(id);
  }
  return updateProducerOrder(id, {
    deliveryNote: "Final stems approved — mark the project complete when ready.",
  });
}

export function getOrdersForVocalist(vocalistId: string): ProducerOrder[] {
  return syncOrdersSnapshot().filter((order) => order.vocalistId === vocalistId);
}

export function markOrderCompleted(id: string): ProducerOrder | null {
  return updateProducerOrder(id, {
    status: "completed",
    deliveryNote: "Project completed. Files archived in your workspace.",
  });
}

export function createMockWorkspaceProject(projectName: string): ProducerOrder {
  return createProducerOrder("vb-demo-vocalist", "Demo Vocalist", {
    projectName: projectName.trim() || "Untitled project",
    trackName: projectName.trim() || "Untitled project",
    producerName: "You",
    description: "Mock workspace project",
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
