"use client";

import {
  HOME_DELIVERY_OPTIONS,
  HOME_GENRE_OPTIONS,
  HOME_LANGUAGE_OPTIONS,
  HOME_MOOD_OPTIONS,
  HOME_PRICE_OPTIONS,
  HOME_VOICE_OPTIONS,
  type HomeSortMode,
  type HomeTrackMood,
} from "@/lib/home-tracks";

export type HomeListFilters = {
  genre: string;
  voiceType: string;
  mood: string;
  language: string;
  price: (typeof HOME_PRICE_OPTIONS)[number];
  delivery: (typeof HOME_DELIVERY_OPTIONS)[number];
  sort: HomeSortMode;
};

export const EXPLORE_DEFAULT_FILTERS: HomeListFilters = {
  genre: "All",
  voiceType: "All",
  mood: "All",
  language: "All",
  price: "All",
  delivery: "All",
  sort: "trending",
};

export const MATCHING_DEFAULT_FILTERS: HomeListFilters = {
  ...EXPLORE_DEFAULT_FILTERS,
  sort: "match",
};

type HomeFiltersBarProps = {
  filters: HomeListFilters;
  onChange: (next: HomeListFilters) => void;
  matchingMode?: boolean;
};

const SORT_OPTIONS: { value: HomeSortMode; label: string }[] = [
  { value: "match", label: "Best match" },
  { value: "new", label: "New" },
  { value: "trending", label: "Trending" },
];

export function HomeFiltersBar({ filters, onChange, matchingMode = false }: HomeFiltersBarProps) {
  const sortOptions = matchingMode
    ? SORT_OPTIONS
    : SORT_OPTIONS.filter((opt) => opt.value !== "match");

  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-zinc-950/50 px-3 py-2 backdrop-blur-md md:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FilterChipGroup
          label="Genre"
          value={filters.genre}
          options={HOME_GENRE_OPTIONS}
          onChange={(genre) => onChange({ ...filters, genre })}
        />
        <FilterChipGroup
          label="Voice tone"
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
        <FilterChipGroup
          label="Language"
          value={filters.language}
          options={[...HOME_LANGUAGE_OPTIONS]}
          onChange={(language) => onChange({ ...filters, language })}
        />
        <FilterChipGroup
          label="Price"
          value={filters.price}
          options={[...HOME_PRICE_OPTIONS]}
          onChange={(price) => onChange({ ...filters, price: price as HomeListFilters["price"] })}
        />
        <FilterChipGroup
          label="Delivery"
          value={filters.delivery}
          options={[...HOME_DELIVERY_OPTIONS]}
          onChange={(delivery) =>
            onChange({ ...filters, delivery: delivery as HomeListFilters["delivery"] })
          }
        />

        {matchingMode && (
          <>
            <span className="hidden h-6 w-px bg-white/10 lg:block" aria-hidden />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Sort
              </span>
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...filters, sort: opt.value })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filters.sort === opt.value
                      ? "bg-gradient-to-r from-purple-500/35 to-cyan-500/20 text-white ring-1 ring-purple-400/45"
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
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
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <span className="mr-0.5 shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            value === opt
              ? "bg-white/10 text-white ring-1 ring-purple-400/35"
              : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function passesPriceFilter(priceUsd: number, filter: HomeListFilters["price"]): boolean {
  if (filter === "All") return true;
  if (filter === "Under $150") return priceUsd < 150;
  if (filter === "$150–$180") return priceUsd >= 150 && priceUsd <= 180;
  return priceUsd > 180;
}

function passesDeliveryFilter(days: number, filter: HomeListFilters["delivery"]): boolean {
  if (filter === "All") return true;
  if (filter === "1–4 days") return days <= 4;
  return days >= 5;
}

export function filterHomeTracks<
  T extends {
    genres: string[];
    voiceType: string;
    mood: HomeTrackMood;
    languages: string[];
    priceUsd: number;
    deliveryDays: number;
    match: number;
    trendingScore: number;
    createdAt: number;
  },
>(tracks: T[], filters: HomeListFilters, matchingMode = false): T[] {
  let list = [...tracks];

  if (filters.genre !== "All") {
    list = list.filter((t) => t.genres.includes(filters.genre));
  }
  if (filters.voiceType !== "All") {
    list = list.filter((t) => t.voiceType === filters.voiceType);
  }
  if (filters.mood !== "All") {
    list = list.filter((t) => t.mood === filters.mood);
  }
  if (filters.language !== "All") {
    list = list.filter((t) => t.languages.includes(filters.language));
  }
  list = list.filter(
    (t) =>
      passesPriceFilter(t.priceUsd, filters.price) &&
      passesDeliveryFilter(t.deliveryDays, filters.delivery)
  );

  const sort = matchingMode ? filters.sort : filters.sort === "match" ? "trending" : filters.sort;

  switch (sort) {
    case "new":
      list.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "trending":
      list.sort((a, b) => b.trendingScore - a.trendingScore);
      break;
    case "match":
      list.sort((a, b) => b.match - a.match);
      break;
    default:
      list.sort((a, b) => b.trendingScore - a.trendingScore);
      break;
  }

  return list;
}
