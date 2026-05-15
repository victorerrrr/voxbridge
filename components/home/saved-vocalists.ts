"use client";

const STORAGE_KEY = "voxbridge_saved_vocalists";

export function getSavedVocalistIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function toggleSavedVocalist(id: string): string[] {
  const current = getSavedVocalistIds();
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
