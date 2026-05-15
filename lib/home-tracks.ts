import type { Vocalist } from "@/lib/mockVocalists";
import { mockVocalists } from "@/lib/mockVocalists";
import { getRankedVocalists } from "@/lib/matching";

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

export function buildHomeWorkspaceTracks(): HomeWorkspaceTrack[] {
  return getRankedVocalists().map((v, i) => trackFromVocalist(v, i));
}

export function buildTracksFromVocalists(vocalists: Vocalist[]): HomeWorkspaceTrack[] {
  return vocalists.map((v, i) => trackFromVocalist(v, i));
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
