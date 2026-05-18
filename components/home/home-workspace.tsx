"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser, UserRole } from "@/lib/auth";
import { buildHomeWorkspaceTracks, type HomeWorkspaceTrack } from "@/lib/home-tracks";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import {
  HomeActiveProjectsStrip,
  useHomeActiveProjects,
  type HomeViewMode,
} from "@/components/home/home-active-projects-strip";
import { HomeDetailPanel } from "@/components/home/home-detail-panel";
import {
  filterHomeTracks,
  HomeFiltersBar,
  type HomeListFilters,
} from "@/components/home/home-filters-bar";
import { HomeTopActionBar } from "@/components/home/home-top-action-bar";
import { HomeTrackList } from "@/components/home/home-track-list";
import { ensureVocalistRequestsSeeded } from "@/lib/vocalist-requests";
import { usePendingVocalistRequests } from "@/lib/hooks/use-vocalist-requests";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";

type HomeWorkspaceProps = {
  user: AuthUser & { role: UserRole };
};

const DEFAULT_FILTERS: HomeListFilters = {
  genre: "All",
  voiceType: "All",
  mood: "All",
  sort: "match",
};

export function HomeWorkspace({ user }: HomeWorkspaceProps) {
  const router = useRouter();
  const { selectTrackId } = useHomeAudio();
  const [filters, setFilters] = useState<HomeListFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<HomeViewMode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allTracks = useMemo(() => buildHomeWorkspaceTracks(), []);
  const activeProjects = useHomeActiveProjects(user.role, user.email);

  const activeVocalistIds = useMemo(
    () => new Set(activeProjects.map((o) => o.vocalistId)),
    [activeProjects]
  );
  const activeTrackNames = useMemo(
    () => new Set(activeProjects.map((o) => o.trackName)),
    [activeProjects]
  );

  const filteredTracks = useMemo(
    () =>
      filterHomeTracks(
        allTracks,
        filters,
        activeVocalistIds,
        activeTrackNames,
        viewMode
      ),
    [allTracks, filters, activeVocalistIds, activeTrackNames, viewMode]
  );

  const selectedTrack = useMemo(() => {
    if (filteredTracks.length === 0) return null;
    const picked = selectedId ? filteredTracks.find((t) => t.id === selectedId) : undefined;
    return picked ?? filteredTracks[0];
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

  return (
    <div className="relative -m-4 flex min-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl md:-m-6 md:min-h-[calc(100vh-8rem)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(168,85,247,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(34,211,238,0.06),transparent)]"
        aria-hidden
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-950/80 shadow-[0_0_60px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        <HomeTopActionBar />

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

        <HomeActiveProjectsStrip
          role={user.role}
          email={user.email}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <HomeFiltersBar filters={filters} onChange={setFilters} />

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-white/5">
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2 md:px-4">
              <h2 className="text-vox-label normal-case tracking-normal text-zinc-400">
                Track feed
              </h2>
              <span className="text-[11px] tabular-nums text-zinc-600">
                {filteredTracks.length} match{filteredTracks.length === 1 ? "" : "es"}
              </span>
            </div>
            <HomeTrackList
              tracks={filteredTracks}
              selectedId={selectedTrack?.id ?? null}
              onSelect={handleSelect}
              onCompare={handleCompare}
              onViewProfile={handleViewProfile}
            />
          </main>

          <HomeDetailPanel track={selectedTrack} onCompare={handleCompare} />
        </div>
      </div>
    </div>
  );
}
