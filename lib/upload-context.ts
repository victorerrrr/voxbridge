"use client";

const STORAGE_KEY = "voxbridge_upload_context";

export type UploadContext = {
  fileName: string;
  trackName: string;
  description: string;
  vibe: string;
  genreTags: string[];
  voiceTags: string[];
  moodTags: string[];
  bpm: string;
  musicalKey: string;
  spotifyUrl: string;
  youtubeUrl: string;
  sunoUrl: string;
  savedAt: string;
};

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSnapshot: UploadContext | null = null;

function syncUploadSnapshot(): UploadContext | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;

  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = null;
    return cachedSnapshot;
  }

  try {
    cachedSnapshot = JSON.parse(raw) as UploadContext;
  } catch {
    cachedSnapshot = null;
  }

  return cachedSnapshot;
}

function emitUploadChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeUploadContext(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export const defaultUploadContext = (): UploadContext => ({
  fileName: "",
  trackName: "",
  description: "",
  vibe: "",
  genreTags: [],
  voiceTags: [],
  moodTags: [],
  bpm: "",
  musicalKey: "",
  spotifyUrl: "",
  youtubeUrl: "",
  sunoUrl: "",
  savedAt: new Date().toISOString(),
});

export function saveUploadContext(context: UploadContext): void {
  if (typeof window === "undefined") return;

  const next: UploadContext = { ...context, savedAt: new Date().toISOString() };
  const raw = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = next;
  emitUploadChange();
}

export function getUploadContext(): UploadContext | null {
  return syncUploadSnapshot();
}

/** True when the user uploaded an AI vocal file (not describe-only). */
export function hasAiVocalUpload(): boolean {
  const ctx = getUploadContext();
  return Boolean(ctx?.fileName?.trim());
}

export function clearUploadContext(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  cachedRaw = null;
  cachedSnapshot = null;
  emitUploadChange();
}
