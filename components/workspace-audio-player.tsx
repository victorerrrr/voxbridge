"use client";

import { useEffect, useRef, useState } from "react";

type WorkspaceAudioPlayerProps = {
  title: string;
  subtitle?: string;
  url?: string;
  emptyHint?: string;
};

export function WorkspaceAudioPlayer({
  title,
  subtitle,
  url,
  emptyHint = "No audio uploaded yet.",
}: WorkspaceAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [durationLabel, setDurationLabel] = useState("—");

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setDurationLabel("—");
    audioRef.current?.pause();
  }, [url]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-zinc-950/80 to-purple-500/10 p-4">
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          className="hidden"
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) {
              setProgress((el.currentTime / el.duration) * 100);
            }
          }}
          onLoadedMetadata={(e) => {
            setDurationLabel(formatTime(e.currentTarget.duration));
          }}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      ) : null}
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={!url}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/15 text-cyan-100 transition hover:border-cyan-200/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p> : null}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {!url ? emptyHint : isPlaying ? "Playing…" : "Tap play to listen"} · {durationLabel}
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
