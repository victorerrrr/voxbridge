"use client";

import { useState } from "react";

type MockAudioPlayerProps = {
  title: string;
  subtitle?: string;
  durationLabel?: string;
};

export function MockAudioPlayer({
  title,
  subtitle = "AI-generated vocal reference (mock)",
  durationLabel = "0:42",
}: MockAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const progress = isPlaying ? 38 : 0;

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-zinc-950/80 to-purple-500/10 p-4">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => setIsPlaying((value) => !value)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/15 text-cyan-100 transition hover:border-cyan-200/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]"
          aria-label={isPlaying ? "Pause preview" : "Play preview"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {isPlaying ? "Playing mock preview…" : "Tap play to preview"} · {durationLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
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
