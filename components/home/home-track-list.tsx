"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FakeWaveform } from "@/components/home/fake-waveform";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { getSavedVocalistIds, toggleSavedVocalist } from "@/components/home/saved-vocalists";
import { createProducerOrder } from "@/lib/orders";
import {
  getTrackMatchReasons,
  toHomeAudioTrack,
  type HomeWorkspaceTrack,
} from "@/lib/home-tracks";

type HomeTrackListProps = {
  tracks: HomeWorkspaceTrack[];
  selectedId: string | null;
  matchingMode: boolean;
  onSelect: (track: HomeWorkspaceTrack) => void;
  onCompare?: (track: HomeWorkspaceTrack) => void;
  onViewProfile: (track: HomeWorkspaceTrack) => void;
};

export function HomeTrackList({
  tracks,
  selectedId,
  matchingMode,
  onSelect,
  onCompare,
  onViewProfile,
}: HomeTrackListProps) {
  const router = useRouter();
  const { playTrack, track: playing, isPlaying, selectedTrackId, activeSide } = useHomeAudio();
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedVocalistIds());

  if (tracks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <FakeWaveform active bars={24} variant="neutral" className="h-10 w-40 opacity-60" />
        <p className="text-sm text-zinc-400">
          {matchingMode ? "No matches for your filters." : "No vocalists match your search."}
        </p>
        <p className="text-xs text-zinc-600">
          {matchingMode
            ? "Try another genre, mood, or switch to All tracks."
            : "Try a different name, genre, or tag."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 md:px-3">
      <ul className="flex flex-col gap-1.5">
        {tracks.map((row) => {
          const isActive = selectedId === row.id || selectedTrackId === row.id;
          const isRowPlaying = playing?.id === row.id && isPlaying;
          const isSaved = savedIds.includes(row.vocalistId);
          const waveformVariant =
            isRowPlaying && playing?.id === row.id ? activeSide : "neutral";
          const matchReasons = matchingMode ? getTrackMatchReasons(row) : [];
          const previewSide = matchingMode ? "ai" : "vocal";

          return (
            <li key={row.id}>
              <article
                role="button"
                tabIndex={0}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                className={`group relative flex cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-3 transition-all duration-300 md:gap-4 md:px-3 md:py-3.5 ${
                  isActive
                    ? "border-purple-400/35 bg-gradient-to-r from-purple-500/20 via-zinc-900/90 to-cyan-500/10 shadow-[0_0_32px_rgba(168,85,247,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "border-white/[0.06] bg-zinc-950/40 hover:scale-[1.01] hover:border-purple-400/20 hover:bg-gradient-to-r hover:from-white/[0.04] hover:to-purple-500/5 hover:shadow-[0_0_28px_rgba(168,85,247,0.12)]"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-purple-400 to-cyan-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]"
                    aria-hidden
                  />
                )}

                <PlayButton
                  isPlaying={isRowPlaying}
                  onClick={() => playTrack(toHomeAudioTrack(row), previewSide)}
                />

                <FakeWaveform
                  active={isRowPlaying || isActive}
                  variant={waveformVariant}
                  bars={22}
                  size="md"
                  className="hidden h-9 w-14 shrink-0 sm:flex md:h-10 md:w-[4.5rem]"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold tracking-tight text-white md:text-base">
                    {row.vocalistName}
                  </p>
                  {!matchingMode && row.tagline && (
                    <p className="truncate text-xs text-zinc-500">{row.tagline}</p>
                  )}
                  {matchingMode && (
                    <p className="truncate text-xs text-zinc-500">{row.trackName}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.genres.slice(0, 2).map((genre) => (
                      <TagChip key={genre} label={genre} />
                    ))}
                    {row.tags.slice(0, matchingMode ? 2 : 3).map((tag) => (
                      <TagChip key={tag} label={tag} />
                    ))}
                    {!matchingMode &&
                      row.languages.slice(0, 2).map((lang) => <TagChip key={lang} label={lang} />)}
                    {!matchingMode && <TagChip label={row.mood} accent />}
                  </div>
                  {!matchingMode && (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      From ${row.priceUsd} · {row.deliveryDays}d delivery
                    </p>
                  )}
                  {matchingMode && matchReasons.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-cyan-400/80">
                      {matchReasons.join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {matchingMode && <MatchBadge match={row.match} active={isActive} />}

                  <div
                    className="flex items-center gap-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100 md:gap-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {matchingMode && onCompare && (
                      <HoverAction label="Compare" onClick={() => onCompare(row)}>
                        Compare
                      </HoverAction>
                    )}
                    <HoverAction
                      label={isSaved ? "Saved" : "Save"}
                      onClick={() => setSavedIds(toggleSavedVocalist(row.vocalistId))}
                      active={isSaved}
                    >
                      {isSaved ? "Saved" : "Save"}
                    </HoverAction>
                    <HoverAction label="Open" onClick={() => onViewProfile(row)}>
                      Open
                    </HoverAction>
                    {!matchingMode && (
                      <HoverAction
                        label="Request vocalist"
                        onClick={() => {
                          const order = createProducerOrder(row.vocalistId, row.vocalistName);
                          router.push(`/workspace/${order.id}`);
                        }}
                      >
                        Request
                      </HoverAction>
                    )}
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlayButton({ isPlaying, onClick }: { isPlaying: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={isPlaying ? "Pause" : "Play preview"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all duration-300 md:h-12 md:w-12 ${
        isPlaying
          ? "border-cyan-400/50 bg-gradient-to-br from-purple-500/35 to-cyan-500/25 text-white shadow-[0_0_24px_rgba(34,211,238,0.35)]"
          : "border-white/15 bg-black/50 text-zinc-200 hover:border-purple-400/45 hover:bg-purple-500/20 hover:text-white hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] group-hover:scale-105"
      }`}
    >
      {isPlaying ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

function MatchBadge({ match, active }: { match: number; active: boolean }) {
  return (
    <span
      className={`rounded-lg px-2 py-1 text-sm font-bold tabular-nums transition ${
        active
          ? "bg-purple-500/25 text-purple-200 ring-1 ring-purple-400/40 shadow-[0_0_16px_rgba(168,85,247,0.25)]"
          : "bg-white/5 text-purple-300 group-hover:bg-purple-500/15"
      }`}
    >
      {match}%
    </span>
  );
}

function TagChip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
        accent
          ? "border border-cyan-400/25 bg-cyan-500/10 text-cyan-200/90"
          : "border border-white/10 bg-black/30 text-zinc-400"
      }`}
    >
      {label}
    </span>
  );
}

function HoverAction({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition ${
        active
          ? "bg-purple-500/25 text-purple-200"
          : "text-zinc-500 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}
