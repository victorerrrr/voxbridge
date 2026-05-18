"use client";

import { FakeWaveform } from "@/components/home/fake-waveform";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { useAiVocalExists } from "@/lib/hooks/use-upload-context";

export function HomeMiniPlayer() {
  const matchingMode = useAiVocalExists();
  const {
    track,
    isPlaying,
    activeSide,
    abCompare,
    togglePlay,
    setActiveSide,
    toggleAbCompare,
  } = useHomeAudio();

  if (!track) return null;

  const sideLabel = activeSide === "ai" ? track.aiLabel : track.vocalLabel;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-zinc-950/90 px-3 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:pl-24 md:pr-6 md:py-3.5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" aria-hidden />

      <div className="mx-auto flex max-w-[1600px] items-center gap-3 md:gap-5">
        <button
          type="button"
          onClick={togglePlay}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-white transition-all duration-300 md:h-14 md:w-14 ${
            isPlaying
              ? "border-cyan-400/50 bg-gradient-to-br from-purple-500/40 to-cyan-500/25 shadow-[0_0_28px_rgba(34,211,238,0.35)] scale-105"
              : "border-purple-400/40 bg-purple-500/20 hover:shadow-[0_0_24px_rgba(168,85,247,0.35)]"
          }`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <FakeWaveform
          active={isPlaying}
          variant={activeSide}
          bars={36}
          size="lg"
          className="hidden h-11 min-w-[120px] max-w-[220px] flex-1 sm:flex md:h-12 md:max-w-[280px]"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white md:text-base">{track.title}</p>
          <p className="truncate text-xs text-zinc-500">{sideLabel}</p>
        </div>

        {matchingMode && (
          <>
            <div className="inline-flex shrink-0 rounded-xl border border-white/10 bg-black/50 p-1 backdrop-blur-sm">
              <SideToggle
                active={activeSide === "ai"}
                onClick={() => setActiveSide("ai")}
                label="AI"
                activeClass="bg-purple-500/30 text-white ring-1 ring-purple-400/40"
              />
              <SideToggle
                active={activeSide === "vocal"}
                onClick={() => setActiveSide("vocal")}
                label="Real"
                activeClass="bg-cyan-500/25 text-white ring-1 ring-cyan-400/40"
              />
            </div>

            <button
              type="button"
              onClick={toggleAbCompare}
              className={`hidden shrink-0 rounded-xl border px-3.5 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-300 sm:block ${
                abCompare
                  ? "border-amber-400/45 bg-amber-500/15 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
                  : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
              }`}
              aria-pressed={abCompare}
            >
              A/B
            </button>
          </>
        )}
      </div>
    </footer>
  );
}

function SideToggle({
  active,
  onClick,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active ? activeClass : "text-zinc-500 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}
