"use client";

import { getStoredUser } from "@/lib/auth";
import { getProducerOrders } from "@/lib/orders";
import { getVocalistReviews } from "@/lib/reviews";
import { getVocalistRequests } from "@/lib/vocalist-requests";

const ADMIN_USERS_KEY = "voxbridge_admin_users";
const ADMIN_REPORTS_KEY = "voxbridge_admin_reports";
const ADMIN_CONVERSATIONS_KEY = "voxbridge_admin_conversations";
const ADMIN_MODERATION_KEY = "voxbridge_admin_moderation";

export type AdminUserStatus = "active" | "blocked" | "pending";

export type AdminUserRecord = {
  id: string;
  email: string;
  username: string;
  role: "producer" | "vocalist" | "admin";
  status: AdminUserStatus;
  createdAt: string;
  isMock?: boolean;
};

export type AdminReport = {
  id: string;
  type: "user" | "message" | "content";
  subject: string;
  status: "open" | "resolved";
  createdAt: string;
};

export type AdminConversation = {
  id: string;
  participants: string;
  lastMessage: string;
  flagged: boolean;
  updatedAt: string;
};

export type ModerationItem = {
  id: string;
  kind: "demo" | "profile" | "link" | "report";
  title: string;
  owner: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
};

export type AdminDashboardStats = {
  totalUsers: number;
  activeOrders: number;
  pendingRequests: number;
  openWorkspaces: number;
  recentMessages: number;
  openReports: number;
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeAdminStore(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const MOCK_USERS: AdminUserRecord[] = [
  {
    id: "mock-producer-1",
    email: "alex.producer@demo.vox",
    username: "AlexProducer",
    role: "producer",
    status: "active",
    createdAt: "2025-11-02T10:00:00.000Z",
    isMock: true,
  },
  {
    id: "mock-vocalist-1",
    email: "luna.vocal@demo.vox",
    username: "LunaVox",
    role: "vocalist",
    status: "active",
    createdAt: "2025-11-05T14:30:00.000Z",
    isMock: true,
  },
  {
    id: "mock-vocalist-2",
    email: "echo.singer@demo.vox",
    username: "EchoSinger",
    role: "vocalist",
    status: "pending",
    createdAt: "2026-01-12T09:15:00.000Z",
    isMock: true,
  },
  {
    id: "admin",
    email: "admin",
    username: "Admin",
    role: "admin",
    status: "active",
    createdAt: "2025-01-01T00:00:00.000Z",
    isMock: true,
  },
];

const MOCK_REPORTS: AdminReport[] = [
  {
    id: "rep-1",
    type: "content",
    subject: "External link flagged on vocalist profile",
    status: "open",
    createdAt: "2026-05-10T11:20:00.000Z",
  },
  {
    id: "rep-2",
    type: "message",
    subject: "Spam in workspace chat",
    status: "open",
    createdAt: "2026-05-12T08:45:00.000Z",
  },
  {
    id: "rep-3",
    type: "user",
    subject: "Impersonation report",
    status: "resolved",
    createdAt: "2026-04-28T16:00:00.000Z",
  },
];

const MOCK_CONVERSATIONS: AdminConversation[] = [
  {
    id: "conv-1",
    participants: "AlexProducer ↔ LunaVox",
    lastMessage: "Preview sounds great — sending final notes.",
    flagged: false,
    updatedAt: "2026-05-17T19:30:00.000Z",
  },
  {
    id: "conv-2",
    participants: "StudioNova ↔ EchoSinger",
    lastMessage: "Can you tighten the ad-libs on the hook?",
    flagged: true,
    updatedAt: "2026-05-16T14:10:00.000Z",
  },
  {
    id: "conv-3",
    participants: "Demo Producer ↔ Demo Vocalist",
    lastMessage: "Uploaded revision v2 to workspace.",
    flagged: false,
    updatedAt: "2026-05-15T09:00:00.000Z",
  },
];

const MOCK_MODERATION: ModerationItem[] = [
  {
    id: "mod-1",
    kind: "demo",
    title: "Midnight Drive — vocal demo",
    owner: "LunaVox",
    status: "pending",
    submittedAt: "2026-05-14T12:00:00.000Z",
  },
  {
    id: "mod-2",
    kind: "profile",
    title: "EchoSinger profile bio",
    owner: "EchoSinger",
    status: "pending",
    submittedAt: "2026-05-13T10:30:00.000Z",
  },
  {
    id: "mod-3",
    kind: "link",
    title: "SoundCloud link on profile",
    owner: "LunaVox",
    status: "pending",
    submittedAt: "2026-05-12T18:00:00.000Z",
  },
  {
    id: "mod-4",
    kind: "report",
    title: "User report — spam message",
    owner: "System",
    status: "pending",
    submittedAt: "2026-05-11T09:00:00.000Z",
  },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  emit();
}

async function accountToAdminUser(): Promise<AdminUserRecord | null> {
  const user = await getStoredUser();
  if (!user?.isAuthenticated || user.email === "admin") return null;
  return {
    id: user.email.toLowerCase(),
    email: user.email,
    username: user.username,
    role: user.role === "admin" ? "admin" : user.role,
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  const overrides = readJson<Record<string, Partial<AdminUserRecord>>>(ADMIN_USERS_KEY, {});
  const stored = await accountToAdminUser();
  const base = [...MOCK_USERS];
  if (stored && !base.some((u) => u.id === stored.id)) {
    base.unshift({ ...stored, isMock: false });
  }
  return base.map((user) => ({
    ...user,
    ...overrides[user.id],
    role: (overrides[user.id]?.role as AdminUserRecord["role"]) ?? user.role,
    status: (overrides[user.id]?.status as AdminUserStatus) ?? user.status,
  }));
}

export function updateAdminUser(id: string, patch: Partial<AdminUserRecord>): void {
  const overrides = readJson<Record<string, Partial<AdminUserRecord>>>(ADMIN_USERS_KEY, {});
  overrides[id] = { ...overrides[id], ...patch };
  writeJson(ADMIN_USERS_KEY, overrides);
}

export function getAdminReports(): AdminReport[] {
  const overrides = readJson<Record<string, AdminReport>>(ADMIN_REPORTS_KEY, {});
  return MOCK_REPORTS.map((report) => overrides[report.id] ?? report);
}

export function updateAdminReport(id: string, status: AdminReport["status"]): void {
  const overrides = readJson<Record<string, AdminReport>>(ADMIN_REPORTS_KEY, {});
  const current = getAdminReports().find((r) => r.id === id);
  if (current) {
    overrides[id] = { ...current, status };
    writeJson(ADMIN_REPORTS_KEY, overrides);
  }
}

export function getAdminConversations(): AdminConversation[] {
  const stored = readJson<AdminConversation[]>(ADMIN_CONVERSATIONS_KEY, []);
  if (stored.length === 0) return MOCK_CONVERSATIONS;
  return stored;
}

export function getAdminConversation(id: string): AdminConversation | undefined {
  return getAdminConversations().find((c) => c.id === id);
}

export function getModerationQueue(): ModerationItem[] {
  const stored = readJson<ModerationItem[]>(ADMIN_MODERATION_KEY, []);
  if (stored.length === 0) return MOCK_MODERATION;
  return stored;
}

export function updateModerationItem(id: string, status: ModerationItem["status"]): void {
  const queue = getModerationQueue().map((item) =>
    item.id === id ? { ...item, status } : item
  );
  writeJson(ADMIN_MODERATION_KEY, queue);
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const users = await getAdminUsers();
  const orders = await getProducerOrders();
  const requests = await getVocalistRequests();
  const reviews = getVocalistReviews();
  const reports = getAdminReports().filter((r) => r.status === "open");
  const conversations = getAdminConversations();

  const activeOrders = orders.filter((o) => o.status !== "completed").length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const openWorkspaces = orders.filter(
    (o) => o.status !== "completed" && o.status !== "delivery_ready"
  ).length;

  return {
    totalUsers: users.length,
    activeOrders,
    pendingRequests,
    openWorkspaces,
    recentMessages: conversations.length + Math.min(reviews.length, 5),
    openReports: reports.length,
  };
}

export type AdminMessage = {
  id: string;
  sender: string;
  body: string;
  at: string;
};

const MOCK_THREAD: Record<string, AdminMessage[]> = {
  "conv-1": [
    { id: "m1", sender: "AlexProducer", body: "Hey — loved your demo tone.", at: "2026-05-17T18:00:00.000Z" },
    { id: "m2", sender: "LunaVox", body: "Thanks! I can match that airy top end.", at: "2026-05-17T18:45:00.000Z" },
    { id: "m3", sender: "AlexProducer", body: "Preview sounds great — sending final notes.", at: "2026-05-17T19:30:00.000Z" },
  ],
  "conv-2": [
    { id: "m1", sender: "StudioNova", body: "Flagged test — please review.", at: "2026-05-16T12:00:00.000Z" },
    { id: "m2", sender: "EchoSinger", body: "Can you tighten the ad-libs on the hook?", at: "2026-05-16T14:10:00.000Z" },
  ],
  "conv-3": [
    { id: "m1", sender: "Demo Producer", body: "Uploaded revision v2 to workspace.", at: "2026-05-15T09:00:00.000Z" },
  ],
};

export function getAdminThreadMessages(conversationId: string): AdminMessage[] {
  return MOCK_THREAD[conversationId] ?? [
    { id: "m0", sender: "System", body: "No messages in this thread.", at: new Date().toISOString() },
  ];
}
