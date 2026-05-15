"use client";

const STORAGE_KEY = "voxbridge_vocalist_profiles";

export type VocalistDemo = {
  id: string;
  trackName: string;
  description: string;
  fileName: string;
};

export type VocalistTags = {
  genres: string[];
  moods: string[];
  voiceTypes: string[];
};

export const DEFAULT_GENRE_TAG_OPTIONS = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "R&B",
  "Rap",
  "Soul",
  "Jazz",
  "Country",
  "Electronic",
  "House",
  "Techno",
  "EDM",
  "Afro House",
  "Indie",
  "Cinematic",
  "Latin",
  "Reggae",
  "Metal",
  "Folk",
  "Trap",
  "Drill",
  "Hyperpop",
];

export const DEFAULT_MOOD_TAG_OPTIONS = [
  "Dark",
  "Emotional",
  "Uplifting",
  "Cinematic",
  "Energetic",
  "Chill",
  "Melancholic",
  "Dreamy",
  "Aggressive",
  "Romantic",
];

export const DEFAULT_VOICE_TAG_OPTIONS = [
  "Warm",
  "Airy",
  "Husky",
  "Deep",
  "Bright",
  "Soulful",
  "Raspy",
  "Smooth",
  "Powerful",
  "Breathy",
  "Falsetto",
  "Belty",
];

export function buildInitialMatchingTags(profile?: VocalistProfile): VocalistTags {
  const existing = profile?.tags ?? { genres: [], moods: [], voiceTypes: [] };
  const profileGenres = profile?.genres ?? [];
  const profileVoices = profile?.voiceTones ?? [];

  return {
    genres: [...new Set([...profileGenres, ...existing.genres])],
    moods: [...existing.moods],
    voiceTypes: [...new Set([...profileVoices, ...existing.voiceTypes])],
  };
}

export function mergeMatchingTagsForSave(
  profile: VocalistProfile,
  tags: VocalistTags
): VocalistTags {
  return {
    genres: [...new Set([...(profile.genres ?? []), ...tags.genres])],
    moods: [...new Set(tags.moods)],
    voiceTypes: [...new Set([...(profile.voiceTones ?? []), ...tags.voiceTypes])],
  };
}

export function getAdditionalGenreOptions(profileGenres: string[]): string[] {
  const selected = new Set(profileGenres);
  return DEFAULT_GENRE_TAG_OPTIONS.filter((genre) => !selected.has(genre));
}

export type VocalistProfile = {
  id: string;
  ownerEmail: string;
  username: string;
  bio: string;
  voiceTones: string[];
  genres: string[];
  languages: string[];
  vocalRange: string;
  studioEquipment: string;
  demos: VocalistDemo[];
  tags: VocalistTags;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_PROFILES: VocalistProfile[] = [];

const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSnapshot: VocalistProfile[] = EMPTY_PROFILES;

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function sortProfiles(profiles: VocalistProfile[]): VocalistProfile[] {
  return [...profiles].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function syncSnapshot(): VocalistProfile[] {
  if (typeof window === "undefined") return EMPTY_PROFILES;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;

  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = EMPTY_PROFILES;
    return cachedSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as VocalistProfile[];
    const list = Array.isArray(parsed) ? parsed : [];
    cachedSnapshot = list.length === 0 ? EMPTY_PROFILES : sortProfiles(list);
  } catch {
    cachedSnapshot = EMPTY_PROFILES;
  }

  return cachedSnapshot;
}

function readProfiles(): VocalistProfile[] {
  return [...syncSnapshot()];
}

function writeProfiles(profiles: VocalistProfile[]): void {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(profiles);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = profiles.length === 0 ? EMPTY_PROFILES : sortProfiles(profiles);
  emitChange();
}

export function subscribeVocalistProfiles(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getVocalistProfiles(): VocalistProfile[] {
  return syncSnapshot();
}

export function vocalistIdFromEmail(email: string): string {
  const slug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `vb-${slug || "user"}`;
}

export function getVocalistProfileById(id: string): VocalistProfile | undefined {
  return syncSnapshot().find((profile) => profile.id === id);
}

export function getVocalistProfileByEmail(email: string): VocalistProfile | undefined {
  const normalized = email.trim().toLowerCase();
  return syncSnapshot().find((profile) => profile.ownerEmail.toLowerCase() === normalized);
}

export function upsertVocalistProfile(
  email: string,
  patch: Partial<
    Omit<VocalistProfile, "id" | "ownerEmail" | "createdAt" | "updatedAt" | "demos" | "tags">
  > & {
    demos?: VocalistDemo[];
    tags?: VocalistTags;
  }
): VocalistProfile {
  const profiles = readProfiles();
  const normalizedEmail = email.trim().toLowerCase();
  const id = vocalistIdFromEmail(normalizedEmail);
  const now = new Date().toISOString();
  const existing = profiles.find((p) => p.ownerEmail.toLowerCase() === normalizedEmail);

  const next: VocalistProfile = {
    id,
    ownerEmail: normalizedEmail,
    username: patch.username ?? existing?.username ?? "",
    bio: patch.bio ?? existing?.bio ?? "",
    voiceTones: patch.voiceTones ?? existing?.voiceTones ?? [],
    genres: patch.genres ?? existing?.genres ?? [],
    languages: patch.languages ?? existing?.languages ?? [],
    vocalRange: patch.vocalRange ?? existing?.vocalRange ?? "",
    studioEquipment: patch.studioEquipment ?? existing?.studioEquipment ?? "",
    demos: patch.demos ?? existing?.demos ?? [],
    tags: patch.tags ?? existing?.tags ?? { genres: [], moods: [], voiceTypes: [] },
    onboardingComplete: patch.onboardingComplete ?? existing?.onboardingComplete ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    const index = profiles.findIndex((p) => p.id === existing.id);
    profiles[index] = next;
  } else {
    profiles.unshift(next);
  }

  writeProfiles(profiles);
  return next;
}

export function addVocalistDemo(email: string, demo: Omit<VocalistDemo, "id">): VocalistProfile {
  const profile = getVocalistProfileByEmail(email);
  const demos = profile?.demos ?? [];
  const nextDemo: VocalistDemo = {
    ...demo,
    id: `demo-${Date.now().toString(36)}`,
  };
  return upsertVocalistProfile(email, {
    demos: [...demos, nextDemo],
    username: profile?.username,
    bio: profile?.bio,
  });
}

export function setVocalistTags(email: string, tags: VocalistTags): VocalistProfile {
  return upsertVocalistProfile(email, { tags, onboardingComplete: true });
}

export function getCompletedOrdersCount(vocalistId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem("voxbridge_producer_orders");
    if (!raw) return 0;
    const orders = JSON.parse(raw) as { vocalistId?: string; status?: string }[];
    if (!Array.isArray(orders)) return 0;
    return orders.filter((o) => o.vocalistId === vocalistId && o.status === "completed").length;
  } catch {
    return 0;
  }
}
