import type { Vocalist } from "@/lib/mockVocalists";
import { mockVocalists } from "@/lib/mockVocalists";
import { getRankedVocalists, getVocalistMatchReasons } from "@/lib/matching";

const AI_DEMO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3";

const TRACK_NAMES = [
  "Midnight Drive",
  "Neon Pulse",
  "Glass Horizon",
  "Velvet Sky",
  "Echo Chamber",
  "Solar Drift",
];

const MOODS = ["Warm", "Energetic", "Cinematic", "Dreamy", "Dark", "Uplifting"] as const;
export type HomeTrackMood = (typeof MOODS)[number];

export type HomeWorkspaceTrack = {
  id: string;
  vocalistId: string;
  trackName: string;
  vocalistName: string;
  tagline: string;
  genres: string[];
  voiceType: string;
  mood: HomeTrackMood;
  match: number;
  trendingScore: number;
  createdAt: number;
  description: string;
  tags: string[];
  aiLabel: string;
  vocalLabel: string;
  demoUrl: string;
  aiUrl: string;
  vocalUrl: string;
};

function voiceTypeFromTags(tags: string[]): string {
  const gender = tags.find((t) => t === "Female" || t === "Male");
  return gender ?? tags[0] ?? "Vocal";
}

function moodFromVocalist(vocalist: Vocalist, index: number): HomeTrackMood {
  const tagMood = vocalist.tags.find((t) =>
    MOODS.some((m) => m.toLowerCase() === t.toLowerCase())
  );
  if (tagMood && MOODS.includes(tagMood as HomeTrackMood)) {
    return tagMood as HomeTrackMood;
  }
  return MOODS[(vocalist.id.length + index) % MOODS.length];
}

function trackFromVocalist(vocalist: Vocalist, index: number): HomeWorkspaceTrack {
  const trackName = TRACK_NAMES[index % TRACK_NAMES.length];
  const createdAt = Date.now() - (index + 1) * 86_400_000 * 3;
  const trendingScore = 40 + ((vocalist.match + index * 13) % 55);

  return {
    id: `track-${vocalist.id}`,
    vocalistId: vocalist.id,
    trackName,
    vocalistName: vocalist.name,
    tagline: vocalist.tagline,
    genres: vocalist.genres,
    voiceType: voiceTypeFromTags(vocalist.tags),
    mood: moodFromVocalist(vocalist, index),
    match: vocalist.match,
    trendingScore,
    createdAt,
    description: vocalist.description,
    tags: [...vocalist.genres, ...vocalist.tags],
    aiLabel: "AI vocal draft",
    vocalLabel: `${vocalist.name} — real take`,
    demoUrl: vocalist.demoUrl,
    aiUrl: AI_DEMO_URL,
    vocalUrl: vocalist.demoUrl,
  };
}

/** Explore mode: browse vocalists without AI match scores. */
export function buildExploreTracks(): HomeWorkspaceTrack[] {
  const vocalists = [...mockVocalists].sort((a, b) => a.name.localeCompare(b.name));
  return vocalists.map((v, i) => {
    const track = trackFromVocalist({ ...v, match: 0 }, i);
    return { ...track, trackName: v.name };
  });
}

/** Matching mode: ranked vocalists after AI vocal upload. */
export function buildMatchingTracks(): HomeWorkspaceTrack[] {
  return getRankedVocalists().map((v, i) => trackFromVocalist(v, i));
}

export function buildHomeWorkspaceTracks(matchingMode: boolean): HomeWorkspaceTrack[] {
  return matchingMode ? buildMatchingTracks() : buildExploreTracks();
}

export function buildTracksFromVocalists(vocalists: Vocalist[]): HomeWorkspaceTrack[] {
  return vocalists.map((v, i) => trackFromVocalist(v, i));
}

export function getTrackMatchReasons(track: HomeWorkspaceTrack): string[] {
  const vocalist = mockVocalists.find((v) => v.id === track.vocalistId);
  return vocalist ? getVocalistMatchReasons(vocalist) : [];
}

export function filterTracksBySearch<T extends HomeWorkspaceTrack>(
  tracks: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;

  return tracks.filter((t) => {
    const haystack = [
      t.vocalistName,
      t.trackName,
      ...t.genres,
      ...t.tags,
      t.voiceType,
      t.mood,
      t.description,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export const HOME_GENRE_OPTIONS = [
  "All",
  ...Array.from(new Set(mockVocalists.flatMap((v) => v.genres))),
];

export const HOME_VOICE_OPTIONS = [
  "All",
  ...Array.from(
    new Set(
      mockVocalists.flatMap((v) => v.tags.filter((t) => t === "Female" || t === "Male"))
    )
  ),
];

export const HOME_MOOD_OPTIONS = ["All", ...MOODS] as const;

export type HomeSortMode = "new" | "match" | "trending";

export function toHomeAudioTrack(track: HomeWorkspaceTrack) {
  return {
    id: track.id,
    title: track.trackName,
    aiLabel: track.aiLabel,
    vocalLabel: track.vocalLabel,
    aiUrl: track.aiUrl,
    vocalUrl: track.vocalUrl,
  };
}
