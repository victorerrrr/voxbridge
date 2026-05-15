"use client";

import {
  HOME_GENRE_OPTIONS,
  HOME_MOOD_OPTIONS,
  HOME_VOICE_OPTIONS,
  type HomeSortMode,
  type HomeTrackMood,
} from "@/lib/home-tracks";

export type HomeListFilters = {
  genre: string;
  voiceType: string;
  mood: string;
  sort: HomeSortMode;
};

type HomeFiltersBarProps = {
  filters: HomeListFilters;
  onChange: (next: HomeListFilters) => void;
};

const SORT_OPTIONS: { value: HomeSortMode; label: string }[] = [
  { value: "match", label: "Best match" },
  { value: "new", label: "New" },
  { value: "trending", label: "Trending" },
];

export function HomeFiltersBar({ filters, onChange }: HomeFiltersBarProps) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-zinc-950/60 px-2 py-2 backdrop-blur-md md:px-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FilterChipGroup
          label="Genre"
          value={filters.genre}
          options={HOME_GENRE_OPTIONS}
          onChange={(genre) => onChange({ ...filters, genre })}
        />
        <FilterChipGroup
          label="Voice"
          value={filters.voiceType}
          options={[...HOME_VOICE_OPTIONS]}
          onChange={(voiceType) => onChange({ ...filters, voiceType })}
        />
        <FilterChipGroup
          label="Mood"
          value={filters.mood}
          options={[...HOME_MOOD_OPTIONS]}
          onChange={(mood) => onChange({ ...filters, mood })}
        />

        <span className="hidden h-6 w-px bg-white/10 lg:block" aria-hidden />

        <div className="flex items-center gap-1.5">
          <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Sort
          </span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filters, sort: opt.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                filters.sort === opt.value
                  ? "bg-gradient-to-r from-purple-500/35 to-cyan-500/20 text-white ring-1 ring-purple-400/45 shadow-[0_0_18px_rgba(168,85,247,0.25)]"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChipGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const visible = options.length > 6 ? options.slice(0, 6) : options;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <span className="mr-0.5 shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </span>
      {visible.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ${
            value === opt
              ? "bg-white/10 text-white ring-1 ring-purple-400/35 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
              : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function filterHomeTracks<
  T extends {
    genres: string[];
    voiceType: string;
    mood: HomeTrackMood;
    match: number;
    trendingScore: number;
    createdAt: number;
    vocalistId: string;
    trackName: string;
  },
>(
  tracks: T[],
  filters: HomeListFilters,
  activeProjectVocalistIds?: Set<string>,
  activeProjectTrackNames?: Set<string>,
  viewMode: "all" | "projects" = "all"
): T[] {
  let list = [...tracks];

  if (viewMode === "projects" && activeProjectVocalistIds) {
    list = list.filter(
      (t) =>
        activeProjectVocalistIds.has(t.vocalistId) ||
        (activeProjectTrackNames?.has(t.trackName) ?? false)
    );
  }

  if (filters.genre !== "All") {
    list = list.filter((t) => t.genres.includes(filters.genre));
  }
  if (filters.voiceType !== "All") {
    list = list.filter((t) => t.voiceType === filters.voiceType);
  }
  if (filters.mood !== "All") {
    list = list.filter((t) => t.mood === filters.mood);
  }

  switch (filters.sort) {
    case "new":
      list.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "trending":
      list.sort((a, b) => b.trendingScore - a.trendingScore);
      break;
    case "match":
    default:
      list.sort((a, b) => b.match - a.match);
      break;
  }

  return list;
}
