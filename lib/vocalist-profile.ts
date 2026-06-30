"use client";

import type { ExternalLinks } from "@/lib/external-links";
import { supabase } from "@/lib/supabase-client";

export type RecordingEnvironment = "home" | "professional" | "both" | "";
export type RecordingSetup = {
  microphone: string;
  audioInterface: string;
  daw: string;
  environment: RecordingEnvironment;
  studioSessionsAvailable: boolean | null;
};

export const VOICE_CHARACTERISTIC_OPTIONS = [
  "Warm", "Airy", "Dark", "Bright", "Raspy", "Soft", "Powerful",
  "Emotional", "Breathable", "Aggressive", "Smooth", "Nasal", "Deep", "Thin", "Rich",
] as const;

export const VOCAL_TYPE_OPTIONS = ["Soprano", "Mezzo", "Alto", "Tenor", "Baritone", "Bass"] as const;
export const VOCAL_REGISTER_OPTIONS = ["High", "Mid", "Low", "Wide"] as const;

export const MICROPHONE_PRESETS = [
  "Neumann U87", "Neumann TLM 103", "Shure SM7B", "Shure SM58",
  "Rode NT1", "AKG C414", "Audio-Technica AT4040", "Other",
] as const;

export const AUDIO_INTERFACE_PRESETS = [
  "Universal Audio Apollo", "Focusrite Scarlett", "Audient iD14",
  "RME Babyface", "Motu M4", "Other",
] as const;

export const DAW_PRESETS = [
  "Pro Tools", "Logic Pro", "Ableton Live", "FL Studio",
  "Cubase", "Reaper", "Studio One", "Other",
] as const;

export const EMPTY_RECORDING_SETUP: RecordingSetup = {
  microphone: "",
  audioInterface: "",
  daw: "",
  environment: "",
  studioSessionsAvailable: null,
};

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
  "Pop", "Rock", "Hip-Hop", "R&B", "Rap", "Soul", "Jazz", "Country",
  "Electronic", "House", "Techno", "EDM", "Afro House", "Indie",
  "Cinematic", "Latin", "Reggae", "Metal", "Folk", "Trap", "Drill", "Hyperpop",
];

export const DEFAULT_MOOD_TAG_OPTIONS = [
  "Dark", "Emotional", "Uplifting", "Cinematic", "Energetic",
  "Chill", "Melancholic", "Dreamy", "Aggressive", "Romantic",
];

export const DEFAULT_VOICE_TAG_OPTIONS = [
  "Warm", "Airy", "Husky", "Deep", "Bright", "Soulful",
  "Raspy", "Smooth", "Powerful", "Breathy", "Falsetto", "Belty",
];

export type VocalistProfile = {
  id: string;
  ownerId: string;
  username: string;
  bio: string;
  voiceTones: string[];
  voiceCharacteristics: string[];
  genres: string[];
  languages: string[];
  vocalRange: string;
  studioEquipment: string;
  recordingSetup: RecordingSetup;
  externalLinks: ExternalLinks;
  demos: VocalistDemo[];
  tags: VocalistTags;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

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

const listeners = new Set<() => void>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeVocalistProfiles(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

type DbVocalistProfileRow = {
  id: string;
  owner_id: string;
  bio: string;
  voice_tones: string[];
  voice_characteristics: string[];
  genres: string[];
  languages: string[];
  vocal_range: string;
  studio_equipment: string;
  recording_setup_microphone: string;
  recording_setup_audio_interface: string;
  recording_setup_daw: string;
  recording_setup_environment: RecordingEnvironment;
  recording_setup_studio_sessions_available: boolean | null;
  tags_genres: string[];
  tags_moods: string[];
  tags_voice_types: string[];
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
};

type DbVocalistDemoRow = {
  id: string;
  track_name: string;
  description: string;
  file_name: string;
};

type DbUserJoinRow = {
  username: string;
  external_link_spotify: string | null;
  external_link_soundcloud: string | null;
  external_link_youtube: string | null;
  external_link_instagram: string | null;
  external_link_website: string | null;
};

function rowToProfile(
  row: DbVocalistProfileRow,
  user: DbUserJoinRow,
  demos: DbVocalistDemoRow[]
): VocalistProfile {
  const externalLinks: ExternalLinks = {};
  if (user.external_link_spotify) externalLinks.spotify = user.external_link_spotify;
  if (user.external_link_soundcloud) externalLinks.soundcloud = user.external_link_soundcloud;
  if (user.external_link_youtube) externalLinks.youtube = user.external_link_youtube;
  if (user.external_link_instagram) externalLinks.instagram = user.external_link_instagram;
  if (user.external_link_website) externalLinks.website = user.external_link_website;

  return {
    id: row.id,
    ownerId: row.owner_id,
    username: user.username,
    bio: row.bio,
    voiceTones: row.voice_tones ?? [],
    voiceCharacteristics: row.voice_characteristics ?? [],
    genres: row.genres ?? [],
    languages: row.languages ?? [],
    vocalRange: row.vocal_range,
    studioEquipment: row.studio_equipment,
    recordingSetup: {
      microphone: row.recording_setup_microphone,
      audioInterface: row.recording_setup_audio_interface,
      daw: row.recording_setup_daw,
      environment: row.recording_setup_environment,
      studioSessionsAvailable: row.recording_setup_studio_sessions_available,
    },
    externalLinks,
    demos: demos.map((d) => ({
      id: d.id,
      trackName: d.track_name,
      description: d.description,
      fileName: d.file_name,
    })),
    tags: {
      genres: row.tags_genres ?? [],
      moods: row.tags_moods ?? [],
      voiceTypes: row.tags_voice_types ?? [],
    },
    onboardingComplete: row.onboarding_complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PROFILE_SELECT =
  "*, users!vocalist_profiles_owner_id_fkey(username, external_link_spotify, external_link_soundcloud, external_link_youtube, external_link_instagram, external_link_website)";

export async function getVocalistProfileById(id: string): Promise<VocalistProfile | undefined> {
  const { data: row, error } = await supabase
    .from("vocalist_profiles")
    .select(PROFILE_SELECT)
    .eq("id", id)
    .single();
  if (error || !row) return undefined;

  const { data: demos } = await supabase
    .from("vocalist_demos")
    .select("id, track_name, description, file_name")
    .eq("vocalist_profile_id", id);

  const userJoin = (row as unknown as { users: DbUserJoinRow }).users;
  return rowToProfile(row as unknown as DbVocalistProfileRow, userJoin, demos ?? []);
}

export async function getVocalistProfileByOwnerId(
  ownerId: string
): Promise<VocalistProfile | undefined> {
  const { data: row, error } = await supabase
    .from("vocalist_profiles")
    .select(PROFILE_SELECT)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error || !row) return undefined;

  const { data: demos } = await supabase
    .from("vocalist_demos")
    .select("id, track_name, description, file_name")
    .eq("vocalist_profile_id", row.id);

  const userJoin = (row as unknown as { users: DbUserJoinRow }).users;
  return rowToProfile(row as unknown as DbVocalistProfileRow, userJoin, demos ?? []);
}

export async function upsertVocalistProfile(
  ownerId: string,
  patch: Partial<
    Omit<VocalistProfile, "id" | "ownerId" | "createdAt" | "updatedAt" | "demos" | "tags">
  > & {
    demos?: VocalistDemo[];
    tags?: VocalistTags;
  }
): Promise<VocalistProfile> {
  const existing = await getVocalistProfileByOwnerId(ownerId);

  if (patch.username !== undefined || patch.externalLinks !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (patch.username !== undefined) userPatch.username = patch.username;
    if (patch.externalLinks !== undefined) {
      userPatch.external_link_spotify = patch.externalLinks.spotify ?? null;
      userPatch.external_link_soundcloud = patch.externalLinks.soundcloud ?? null;
      userPatch.external_link_youtube = patch.externalLinks.youtube ?? null;
      userPatch.external_link_instagram = patch.externalLinks.instagram ?? null;
      userPatch.external_link_website = patch.externalLinks.website ?? null;
    }
    await supabase.from("users").update(userPatch).eq("id", ownerId);
  }

  const recordingSetup = patch.recordingSetup ?? existing?.recordingSetup ?? EMPTY_RECORDING_SETUP;
  const tags = patch.tags ?? existing?.tags ?? { genres: [], moods: [], voiceTypes: [] };

  const profileRow = {
    owner_id: ownerId,
    bio: patch.bio ?? existing?.bio ?? "",
    voice_tones: patch.voiceTones ?? existing?.voiceTones ?? [],
    voice_characteristics: patch.voiceCharacteristics ?? existing?.voiceCharacteristics ?? [],
    genres: patch.genres ?? existing?.genres ?? [],
    languages: patch.languages ?? existing?.languages ?? [],
    vocal_range: patch.vocalRange ?? existing?.vocalRange ?? "",
    studio_equipment: patch.studioEquipment ?? existing?.studioEquipment ?? "",
    recording_setup_microphone: recordingSetup.microphone,
    recording_setup_audio_interface: recordingSetup.audioInterface,
    recording_setup_daw: recordingSetup.daw,
    recording_setup_environment: recordingSetup.environment,
    recording_setup_studio_sessions_available: recordingSetup.studioSessionsAvailable,
    tags_genres: tags.genres,
    tags_moods: tags.moods,
    tags_voice_types: tags.voiceTypes,
    onboarding_complete: patch.onboardingComplete ?? existing?.onboardingComplete ?? false,
  };

  if (existing) {
    await supabase.from("vocalist_profiles").update(profileRow).eq("id", existing.id);
  } else {
    await supabase.from("vocalist_profiles").insert(profileRow);
  }

  emitChange();
  const refreshed = await getVocalistProfileByOwnerId(ownerId);
  if (!refreshed) {
    throw new Error("Failed to read back vocalist profile after upsert.");
  }
  return refreshed;
}

export async function addVocalistDemo(
  ownerId: string,
  demo: Omit<VocalistDemo, "id">
): Promise<VocalistProfile> {
  const profile = await getVocalistProfileByOwnerId(ownerId);
  if (!profile) {
    throw new Error("Cannot add a demo before the vocalist profile exists.");
  }
  await supabase.from("vocalist_demos").insert({
    vocalist_profile_id: profile.id,
    track_name: demo.trackName,
    description: demo.description,
    file_name: demo.fileName,
  });
  emitChange();
  const refreshed = await getVocalistProfileByOwnerId(ownerId);
  if (!refreshed) {
    throw new Error("Failed to read back vocalist profile after adding demo.");
  }
  return refreshed;
}

export async function setVocalistTags(
  ownerId: string,
  tags: VocalistTags
): Promise<VocalistProfile> {
  return upsertVocalistProfile(ownerId, { tags, onboardingComplete: true });
}

export async function getCompletedOrdersCount(vocalistProfileId: string): Promise<number> {
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("vocalist_profile_id", vocalistProfileId)
    .eq("status", "completed");
  return count ?? 0;
}