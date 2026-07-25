"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteOrderFile, resolveOrderFileAudioUrl, type OrderFile } from "@/lib/order-files";

type ReferencePlayerProps = {
  file: OrderFile;
  onDeleted?: () => void;
};

/**
 * Round ▶ play button — loads audio on first tap.
 * If storage is missing the file, shows a clear fix action.
 */
export function ReferencePlayer({ file, onDeleted }: ReferencePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [durationLabel, setDurationLabel] = useState("—");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return () => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, [src]);

  const ensureSrc = useCallback(async () => {
    if (src) return src;
    setLoading(true);
    setError(null);
    try {
      const url = await resolveOrderFileAudioUrl(file.storagePath, file.playbackUrl);
      setSrc(url);
      return url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cannot load audio";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [file.playbackUrl, file.storagePath, src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!src) {
      const url = await ensureSrc();
      if (!url) return;
      audio.src = url;
    }
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

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteOrderFile(file);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const isBroken = error?.toLowerCase().includes("not found");

  return (
    <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4">
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          className="hidden"
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress((el.currentTime / el.duration) * 100);
          }}
          onLoadedMetadata={(e) => {
            const s = e.currentTarget.duration;
            if (Number.isFinite(s) && s > 0) {
              const m = Math.floor(s / 60);
              const sec = Math.floor(s % 60);
              setDurationLabel(`${m}:${sec.toString().padStart(2, "0")}`);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      ) : (
        <audio ref={audioRef} className="hidden" />
      )}

      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={loading || deleting || (isBroken && !src)}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-cyan-300/50 bg-cyan-500/20 text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-500/30 hover:shadow-[0_0_24px_rgba(34,211,238,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={isPlaying ? "Pause" : "Play reference"}
        >
          {loading ? <span className="text-xs">…</span> : isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{file.fileName}</p>
          <p className="mt-0.5 text-xs text-cyan-200/80">Нажми ▶ чтобы послушать</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {loading ? "Загрузка…" : isPlaying ? "Играет" : "Готово к прослушиванию"} · {durationLabel}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          <p>{isBroken ? "Файл не сохранился в Storage (битая запись)." : error}</p>
          {isBroken ? (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void onDelete()}
              className="mt-2 rounded-md border border-rose-300/40 px-2 py-1 text-[11px] font-medium text-rose-50 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {deleting ? "Удаляю…" : "Удалить битую запись"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
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
