"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser, UserRole } from "@/lib/auth";
import {
  buildHomeWorkspaceTracks,
  filterTracksBySearch,
  type HomeWorkspaceTrack,
} from "@/lib/home-tracks";
import { useAiVocal, useAiVocalExists } from "@/lib/hooks/use-upload-context";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { HomeActiveProjectsStrip } from "@/components/home/home-active-projects-strip";
import { HomeDetailPanel } from "@/components/home/home-detail-panel";
import {
  EXPLORE_DEFAULT_FILTERS,
  filterHomeTracks,
  HomeFiltersBar,
  MATCHING_DEFAULT_FILTERS,
  type HomeListFilters,
} from "@/components/home/home-filters-bar";
import { HomeTrackList } from "@/components/home/home-track-list";
import { HomeMatchingHeader } from "@/components/home/home-matching-header";
import { HomeDiscoverySearch } from "@/components/home/home-discovery-search";
import { HomeLandingHero } from "@/components/home/home-landing-hero";
import { HomeTransformationDemo } from "@/components/home/home-transformation-demo";
import { HomeFeaturedVocalists } from "@/components/home/home-featured-vocalists";
import { HomeTransformationsFeed } from "@/components/home/home-transformations-feed";
import { ensureVocalistRequestsSeeded } from "@/lib/vocalist-requests";
import { usePendingVocalistRequests } from "@/lib/hooks/use-vocalist-requests";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";

type HomeWorkspaceProps = {
  user: AuthUser & { role: UserRole };
};

export function HomeWorkspace({ user }: HomeWorkspaceProps) {
  const router = useRouter();
  const { selectTrackId } = useHomeAudio();
  const matchingMode = useAiVocalExists();
  const aiVocal = useAiVocal();
  const [filters, setFilters] = useState<HomeListFilters>(EXPLORE_DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setFilters(matchingMode ? MATCHING_DEFAULT_FILTERS : EXPLORE_DEFAULT_FILTERS);
    setSelectedId(null);
    setSearchQuery("");
  }, [matchingMode]);

  const allTracks = useMemo(
    () => buildHomeWorkspaceTracks(matchingMode),
    [matchingMode]
  );

  const filteredTracks = useMemo(() => {
    const byFilters = filterHomeTracks(allTracks, filters, matchingMode);
    return filterTracksBySearch(byFilters, searchQuery);
  }, [allTracks, filters, searchQuery, matchingMode]);

  const selectedTrack = useMemo(() => {
    if (!selectedId) return null;
    return filteredTracks.find((t) => t.id === selectedId) ?? null;
  }, [filteredTracks, selectedId]);

  useEffect(() => {
    if (selectedId && !filteredTracks.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredTracks, selectedId]);

  useEffect(() => {
    if (user.role === "vocalist") ensureVocalistRequestsSeeded();
  }, [user.role]);

  const vocalistId = vocalistIdFromEmail(user.email);
  const pendingRequests = usePendingVocalistRequests(vocalistId);

  const handleSelect = useCallback(
    (track: HomeWorkspaceTrack) => {
      setSelectedId(track.id);
      selectTrackId(track.id);
    },
    [selectTrackId]
  );

  const handleCompare = useCallback(
    (track: HomeWorkspaceTrack) => {
      router.push(`/compare/${track.vocalistId}`);
    },
    [router]
  );

  const handleViewProfile = useCallback(
    (track: HomeWorkspaceTrack) => {
      router.push(`/vocalists/${track.vocalistId}`);
    },
    [router]
  );

  const scrollToFeatured = useCallback(() => {
    document.getElementById("home-featured-vocalists")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const listCountLabel = `${filteredTracks.length} match${filteredTracks.length === 1 ? "" : "es"}`;

  return (
    <div className="relative -m-4 flex min-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl md:-m-6 md:min-h-[calc(100vh-8rem)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(168,85,247,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(34,211,238,0.06),transparent)]"
        aria-hidden
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-950/80 shadow-[0_0_60px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        {user.role === "vocalist" && pendingRequests.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-400/15 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-100/90 md:px-4">
            <span className="font-medium">{pendingRequests.length} incoming request(s)</span>
            <button
              type="button"
              onClick={() => router.push("/vocalist/orders")}
              className="underline decoration-amber-400/50 hover:text-white"
            >
              View
            </button>
          </div>
        )}

        {matchingMode ? (
          <MatchingWorkspace
            aiVocal={aiVocal}
            filteredTracks={filteredTracks}
            selectedTrack={selectedTrack}
            selectedId={selectedId}
            searchQuery={searchQuery}
            filters={filters}
            listCountLabel={listCountLabel}
            onSearchChange={setSearchQuery}
            onFiltersChange={setFilters}
            onSelect={handleSelect}
            onCompare={handleCompare}
            onViewProfile={handleViewProfile}
          />
        ) : (
          <ExploreLanding role={user.role} email={user.email} onBrowse={scrollToFeatured} />
        )}
      </div>
    </div>
  );
}

function ExploreLanding({
  role,
  email,
  onBrowse,
}: {
  role: UserRole;
  email: string;
  onBrowse: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <HomeLandingHero onBrowse={onBrowse} />
      <HomeTransformationDemo />
      <HomeFeaturedVocalists />
      <HomeTransformationsFeed />
      <HomeActiveProjectsStrip role={role} email={email} compact />
    </div>
  );
}

function MatchingWorkspace({
  aiVocal,
  filteredTracks,
  selectedTrack,
  selectedId,
  searchQuery,
  filters,
  listCountLabel,
  onSearchChange,
  onFiltersChange,
  onSelect,
  onCompare,
  onViewProfile,
}: {
  aiVocal: ReturnType<typeof useAiVocal>;
  filteredTracks: HomeWorkspaceTrack[];
  selectedTrack: HomeWorkspaceTrack | null;
  selectedId: string | null;
  searchQuery: string;
  filters: HomeListFilters;
  listCountLabel: string;
  onSearchChange: (q: string) => void;
  onFiltersChange: (f: HomeListFilters) => void;
  onSelect: (track: HomeWorkspaceTrack) => void;
  onCompare: (track: HomeWorkspaceTrack) => void;
  onViewProfile: (track: HomeWorkspaceTrack) => void;
}) {
  return (
    <>
      {aiVocal && <HomeMatchingHeader upload={aiVocal} />}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-white/5">
          <div className="shrink-0 space-y-2 border-b border-white/[0.06] px-3 py-3 md:px-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-vox-label normal-case tracking-normal text-zinc-400">
                Matching results
              </h2>
              <span className="text-[11px] tabular-nums text-zinc-600">{listCountLabel}</span>
            </div>
            <HomeDiscoverySearch
              value={searchQuery}
              onChange={onSearchChange}
              matchingMode
            />
          </div>

          <HomeFiltersBar filters={filters} onChange={onFiltersChange} matchingMode />

          <HomeTrackList
            tracks={filteredTracks}
            selectedId={selectedTrack?.id ?? selectedId}
            matchingMode
            onSelect={onSelect}
            onCompare={onCompare}
            onViewProfile={onViewProfile}
          />
        </main>

        <HomeDetailPanel track={selectedTrack} matchingMode onCompare={onCompare} />
      </div>
    </>
  );
}
