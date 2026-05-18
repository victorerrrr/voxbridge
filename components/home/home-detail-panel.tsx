"use client";

import { AnimatedButton } from "@/components/animated-button";
import { RequestVocalistButton } from "@/components/request-vocalist-button";
import { FakeWaveform } from "@/components/home/fake-waveform";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { getAvatarGradient, getVocalistInitials, getVocalistMatchReasons } from "@/lib/matching";
import { ExternalLinksDisplay } from "@/components/external-links-section";
import { getVocalistById } from "@/lib/mockVocalists";
import { hasExternalLinks } from "@/lib/external-links";
import { getVocalistProfileById } from "@/lib/vocalist-profile";
import { toHomeAudioTrack, type HomeWorkspaceTrack } from "@/lib/home-tracks";

type HomeDetailPanelProps = {
  track: HomeWorkspaceTrack | null;
  matchingMode: boolean;
  onCompare?: (track: HomeWorkspaceTrack) => void;
};

export function HomeDetailPanel({ track, matchingMode, onCompare }: HomeDetailPanelProps) {
  const {
    playTrack,
    track: playing,
    isPlaying,
    activeSide,
    setActiveSide,
    toggleAbCompare,
    abCompare,
  } = useHomeAudio();

  if (!track) {
    return (
      <aside className="hidden w-full shrink-0 flex-col border-l border-white/10 bg-zinc-950/30 p-6 backdrop-blur-xl lg:flex lg:w-[22rem] xl:w-[26rem]">
        <FakeWaveform active bars={32} className="mb-4 h-12 w-full opacity-50" />
        <p className="text-sm text-zinc-500">
          {matchingMode
            ? "Select a match to preview AI vs real vocal, compare takes, and request a vocalist."
            : "Select a vocalist to preview their voice."}
        </p>
      </aside>
    );
  }

  const vocalist = getVocalistById(track.vocalistId);
  const storedProfile = getVocalistProfileById(track.vocalistId);
  const externalLinks = storedProfile?.externalLinks;
  const demos = storedProfile?.demos?.length
    ? storedProfile.demos
    : vocalist
      ? [{ id: "main", trackName: "Main demo", description: "", fileName: vocalist.demoUrl }]
      : [];
  const reasons = matchingMode && vocalist ? getVocalistMatchReasons(vocalist) : [];
  const initials = getVocalistInitials(track.vocalistName);
  const gradient = getAvatarGradient(track.vocalistId);
  const isPlayingThis = playing?.id === track.id && isPlaying;

  return (
    <aside className="hidden w-full shrink-0 flex-col border-l border-white/10 bg-zinc-950/40 backdrop-blur-2xl lg:flex lg:w-[22rem] xl:w-[26rem]">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div
          className={`relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${gradient} p-5 shadow-[0_0_48px_rgba(168,85,247,0.2)]`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-black/30 text-xl font-bold text-white backdrop-blur-sm">
              {initials}
            </span>
            {matchingMode && <MatchRing match={track.match} className="absolute -right-1 -top-1" />}
          </div>
          <h2 className="relative mt-4 text-2xl font-bold tracking-tight text-white">
            {track.vocalistName}
          </h2>
          <p className="relative mt-1 text-sm text-white/75">
            {matchingMode ? track.trackName : track.tagline}
          </p>
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {track.genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="rounded-full border border-white/15 bg-black/25 px-2 py-0.5 text-[10px] text-zinc-200"
              >
                {g}
              </span>
            ))}
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-100">
              {track.mood}
            </span>
          </div>
        </div>

        {matchingMode ? (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Preview
              </span>
              <div className="inline-flex rounded-lg border border-white/10 bg-zinc-950/80 p-0.5">
                <TogglePill
                  active={activeSide === "ai"}
                  onClick={() => setActiveSide("ai")}
                  label="AI"
                  accent="purple"
                />
                <TogglePill
                  active={activeSide === "vocal"}
                  onClick={() => setActiveSide("vocal")}
                  label="Real"
                  accent="cyan"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <PreviewLane
                label="AI vocal"
                active={isPlayingThis && activeSide === "ai"}
                variant="ai"
                onPlay={() => playTrack(toHomeAudioTrack(track), "ai")}
              />
              <PreviewLane
                label="Real vocal"
                active={isPlayingThis && activeSide === "vocal"}
                variant="vocal"
                onPlay={() => playTrack(toHomeAudioTrack(track), "vocal")}
              />
            </div>

            <button
              type="button"
              onClick={toggleAbCompare}
              className={`mt-3 w-full rounded-lg border py-2 text-xs font-semibold uppercase tracking-wide transition ${
                abCompare
                  ? "border-amber-400/45 bg-amber-500/15 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                  : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
              }`}
            >
              A/B Compare
            </button>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Demo preview
            </span>
            <button
              type="button"
              onClick={() => playTrack(toHomeAudioTrack(track), "vocal")}
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 p-3 text-left transition hover:border-cyan-400/35"
            >
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Real vocal sample</p>
              <FakeWaveform
                active={isPlayingThis}
                variant="vocal"
                bars={18}
                size="sm"
                className="mt-2 h-9"
              />
            </button>
          </div>
        )}

        <p className="mb-4 text-sm leading-relaxed text-zinc-400">{track.description}</p>

        {!matchingMode && demos.length > 0 && (
          <ul className="mb-4 space-y-1.5">
            <li className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Demos</li>
            {demos.slice(0, 3).map((demo) => (
              <li key={demo.id}>
                <button
                  type="button"
                  onClick={() => playTrack(toHomeAudioTrack(track), "vocal")}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-xs text-zinc-300 transition hover:border-cyan-400/30"
                >
                  {demo.trackName}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!matchingMode && hasExternalLinks(externalLinks) && (
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Links
            </p>
            <ExternalLinksDisplay links={externalLinks} />
          </div>
        )}

        {matchingMode && reasons.length > 0 && (
          <ul className="mb-4 space-y-2">
            <li className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Why it matches
            </li>
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2 text-xs text-zinc-400">
                <MatchReasonIcon />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mb-4 flex flex-wrap gap-1.5">
          {track.tags.slice(0, 8).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        {vocalist && (
          <p className="mb-4 text-xs text-zinc-500">
            From <span className="font-semibold text-zinc-300">${vocalist.priceUsd}</span> per vocal
          </p>
        )}

        <div className="flex flex-col gap-2">
          <RequestVocalistButton
            vocalistId={track.vocalistId}
            vocalistName={track.vocalistName}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-[0_0_28px_rgba(168,85,247,0.25)]"
          />
          {matchingMode && onCompare && (
            <AnimatedButton
              type="button"
              variant="secondary"
              onClick={() => onCompare(track)}
              className="w-full rounded-xl px-4 py-2.5 text-sm"
            >
              Compare takes
            </AnimatedButton>
          )}
          <AnimatedButton
            href={`/vocalists/${track.vocalistId}`}
            variant="secondary"
            className="w-full rounded-xl px-4 py-2.5 text-sm"
          >
            Open profile
          </AnimatedButton>
        </div>
      </div>
    </aside>
  );
}

function MatchRing({ match, className }: { match: number; className?: string }) {
  return (
    <span
      className={`inline-flex h-11 w-11 flex-col items-center justify-center rounded-full border border-purple-400/40 bg-black/50 text-center backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.35)] ${className ?? ""}`}
    >
      <span className="text-sm font-bold tabular-nums text-purple-200">{match}</span>
      <span className="text-[8px] uppercase text-zinc-500">match</span>
    </span>
  );
}

function TogglePill({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent: "purple" | "cyan";
}) {
  const activeClass =
    accent === "purple"
      ? "bg-purple-500/30 text-white ring-1 ring-purple-400/40"
      : "bg-cyan-500/25 text-white ring-1 ring-cyan-400/40";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-[11px] font-medium transition ${
        active ? activeClass : "text-zinc-500 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function PreviewLane({
  label,
  active,
  variant,
  onPlay,
}: {
  label: string;
  active: boolean;
  variant: "ai" | "vocal";
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={`rounded-lg border p-2.5 text-left transition-all duration-300 ${
        active
          ? "border-purple-400/40 bg-zinc-950/90 shadow-[0_0_24px_rgba(168,85,247,0.2)] scale-[1.02]"
          : "border-white/10 bg-black/25 hover:border-white/20"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <FakeWaveform active={active} variant={variant} bars={18} size="sm" className="mt-2 h-9" />
    </button>
  );
}

function MatchReasonIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6.5 10.5L3.5 7.5l1-1 2 2 5-5 1 1-6 6z" />
    </svg>
  );
}
