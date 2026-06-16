"use client";

/** localStorage key for producer AI vocal / brief (conceptual: aiVocal). */
export const AI_VOCAL_STORAGE_KEY = "voxbridge_upload_context";

const STORAGE_KEY = AI_VOCAL_STORAGE_KEY;

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
  /** Set when a real AI vocal file was uploaded (optional explicit flag). */
  hasAiVocalFile?: boolean;
  aiLanguage?: string;
  partLanguage?: string;
};

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSnapshot: UploadContext | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStoredContext(raw: string): UploadContext | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return parsed as UploadContext;
  } catch {
    return null;
  }
}

/** True only when a real AI vocal upload is present — never for empty objects or vibe-only briefs. */
export function isAiVocalActive(ctx: UploadContext | null | undefined): boolean {
  if (!ctx || !isRecord(ctx)) return false;
  if (ctx.hasAiVocalFile === true) return true;
  const fileName = typeof ctx.fileName === "string" ? ctx.fileName.trim() : "";
  return fileName.length > 0;
}

function syncUploadSnapshot(): UploadContext | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;

  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = null;
    return cachedSnapshot;
  }

  cachedSnapshot = parseStoredContext(raw);
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

  const fileName = context.fileName?.trim() ?? "";
  const next: UploadContext = {
    ...context,
    fileName,
    hasAiVocalFile: fileName.length > 0,
    savedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = next;
  emitUploadChange();
}

/** Raw brief from storage (may exist without an AI vocal file). */
export function getUploadContext(): UploadContext | null {
  return syncUploadSnapshot();
}

/** aiVocal: null when cleared/missing/invalid; object only when matching mode applies. */
export function getAiVocal(): UploadContext | null {
  const ctx = getUploadContext();
  return isAiVocalActive(ctx) ? ctx : null;
}

export function hasAiVocalUpload(): boolean {
  return getAiVocal() !== null;
}

export function clearUploadContext(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  cachedRaw = null;
  cachedSnapshot = null;
  emitUploadChange();
}
