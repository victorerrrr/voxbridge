"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { InternalPageShell } from "@/components/internal-page-shell";
import { AnimatedButton } from "@/components/animated-button";
import { UploadContextBanner } from "@/components/upload-context-banner";
import { useUploadContext } from "@/lib/hooks/use-upload-context";
import { AiVoiceMatchResult, resolveMatchConfidenceLevel, formatMatchConfidenceLabel } from "@/lib/admin-ai-voice-matching";

const CONFIDENCE_COLORS: Record<string, string> = {
  "very-strong": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  good: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  partial: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  weak: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

function ConfidenceBadge({ row }: { row: AiVoiceMatchResult }) {
  const level = resolveMatchConfidenceLevel(row);
  const label = formatMatchConfidenceLabel(level);
  const cls = CONFIDENCE_COLORS[level] ?? CONFIDENCE_COLORS.weak;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function BestMatchButton({ row }: { row: AiVoiceMatchResult }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  if (!row.demoAudioUrl) return null;

  const sec = row.best_match_sec ?? 0;
  const label = sec > 0 ? `▶ Best match ~${Math.round(sec)}s` : "▶ Play demo";

  const toggle = () => {
    if (!audioRef.current) {
      const a = new Audio(row.demoAudioUrl);
      audioRef.current = a;
      a.addEventListener("ended", () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.currentTime = sec;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition"
    >
      {playing ? "⏸ Stop" : label}
    </button>
  );
}

function ResultCard({ row, rank }: { row: AiVoiceMatchResult; rank: number }) {
  const isTop = rank === 0;
  return (
    <article className={`rounded-2xl border p-5 shadow-sm transition ${isTop ? "border-purple-500/40 bg-zinc-900/80" : "border-white/10 bg-zinc-950/60"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-base font-semibold text-white shadow">
            {row.vocalistName?.slice(0, 2).toUpperCase() ?? "??"}
          </div>
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">{row.vocalistName}</h2>
            <p className="text-xs text-zinc-400">{row.displayVocalType}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-2xl font-bold text-white">{row.matchPercent}%</span>
          <ConfidenceBadge row={row} />
        </div>
      </div>

      <div className="mb-3 h-1.5 w-full rounded-full bg-zinc-800">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all"
          style={{ width: `${row.matchPercent}%` }}
        />
      </div>

      {row.matchFeatureTags && row.matchFeatureTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {row.matchFeatureTags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <BestMatchButton row={row} />
        <AnimatedButton
          href={`/vocalists/${row.id}`}
          variant="primary"
          className="inline-flex items-center justify-center rounded-lg px-4 py-1.5 text-xs font-medium"
        >
          View Profile
        </AnimatedButton>
      </div>
    </article>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const uploadContext = useUploadContext();
  const [results, setResults] = useState<AiVoiceMatchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uploadContext === undefined) return;
    if (uploadContext === null) {
      router.replace("/search");
      return;
    }
    try {
      const raw = sessionStorage.getItem("voxbridge_match_results");
      if (!raw) {
        setError("No match results found. Please run matching again.");
        return;
      }
      const data = JSON.parse(raw);
      const rows: AiVoiceMatchResult[] = Array.isArray(data) ? data : data.results ?? [];
      setResults(rows);
    } catch {
      setError("Failed to load results.");
    }
  }, [uploadContext, router]);

  if (uploadContext === undefined || results === null && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading matches...
      </main>
    );
  }

  return (
    <InternalPageShell activeItem="upload">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">AI matching</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Matching Results</h1>
            <p className="mt-2 text-zinc-400">
              {results ? `${results.length} vocalists ranked by acoustic similarity` : "Ranked vocalists for your brief."}
            </p>
          </div>
          <AnimatedButton
            href="/search"
            variant="secondary"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm"
          >
            Upload another reference
          </AnimatedButton>
        </div>

        {uploadContext && <UploadContextBanner context={uploadContext} />}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {results && (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {results.map((row, i) => (
              <ResultCard key={row.id} row={row} rank={i} />
            ))}
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}
