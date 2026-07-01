"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getAvatarGradient, getVocalistMatchReasons } from "@/lib/matching";
import { getVocalistById } from "@/lib/mockVocalists";
import { useUploadContext } from "@/lib/hooks/use-upload-context";

type CompareSide = "ai" | "vocalist";

export default function ComparePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const vocalist = getVocalistById(params.id);
  const [activeSide, setActiveSide] = useState<CompareSide>("ai");
  const uploadContext = useUploadContext();

  useEffect(() => {
    if (uploadContext === null) {
      router.replace("/search");
    }
  }, [uploadContext, router]);

  const reasons = useMemo(
    () => (vocalist ? getVocalistMatchReasons(vocalist) : []),
    [vocalist]
  );

  if (!vocalist) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Vocalist not found.
      </main>
    );
  }

  if (uploadContext === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading compare...
      </main>
    );
  }

  const gradient = getAvatarGradient(vocalist.id);
  const upload = uploadContext;

  return (
    <InternalPageShell activeItem="explore">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/results" className="text-sm text-zinc-400 transition hover:text-zinc-200">
          ← Back to results
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-purple-300/80">Compare mode</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              AI demo vs {vocalist.name}
            </h1>
            <p className="mt-2 text-zinc-400">
              A/B toggle highlights which take you are auditioning.
            </p>
          </div>
          <span className="rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-1.5 text-sm font-medium text-purple-200">
            {vocalist.match}% similarity
          </span>
        </header>

        <div className="inline-flex rounded-xl border border-white/10 bg-zinc-900/80 p-1">
          <button
            type="button"
            onClick={() => setActiveSide("ai")}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              activeSide === "ai"
                ? "bg-purple-500/25 text-white ring-1 ring-purple-400/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Your AI vocal
          </button>
          <button
            type="button"
            onClick={() => setActiveSide("vocalist")}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              activeSide === "vocalist"
                ? "bg-cyan-500/20 text-white ring-1 ring-cyan-400/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {vocalist.name}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ComparePanel
            title="Your AI vocal"
            subtitle={upload?.trackName || "Uploaded reference"}
            active={activeSide === "ai"}
            gradient="from-purple-500/30 to-blue-500/20"
            isAi
          />
          <ComparePanel
            title={vocalist.name}
            subtitle={vocalist.tagline}
            active={activeSide === "vocalist"}
            gradient={gradient}
            audioUrl={vocalist.demoUrl}
            isAi={false}
          />
        </div>

        <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/40 p-6 text-center">
          <p className="text-sm text-zinc-400">
            Overlay waveform comparison — placeholder for real audio analysis
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
          <h2 className="text-lg font-semibold">Why this match works</h2>
          <ul className="mt-3 space-y-2">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                {reason}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          
          <AnimatedButton
            href="/results"
            variant="secondary"
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm"
          >
            Back to Results
          </AnimatedButton>
          <AnimatedButton
            href={`/vocalists/${vocalist.id}`}
            variant="secondary"
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm"
          >
            Open Profile
          </AnimatedButton>
        </div>
      </div>
    </InternalPageShell>
  );
}

function ComparePanel({
  title,
  subtitle,
  active,
  gradient,
  audioUrl,
  isAi,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  gradient: string;
  audioUrl?: string;
  isAi: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 transition ${
        active
          ? "border-purple-400/35 bg-zinc-950/80 shadow-[0_0_40px_-12px_rgba(168,85,247,0.45)]"
          : "border-white/10 bg-zinc-950/50 opacity-80"
      }`}
    >
      <div className={`mb-4 h-2 rounded-full bg-gradient-to-r ${gradient}`} />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      <div className="mt-4 flex h-28 items-end gap-1 rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-3">
        {Array.from({ length: 32 }).map((_, index) => (
          <span
            key={index}
            className={`w-1.5 rounded-full bg-gradient-to-t ${
              isAi ? "from-purple-500/80 to-cyan-400/50" : "from-cyan-500/80 to-purple-400/50"
            }`}
            style={{ height: `${20 + ((index * 13) % 70)}%` }}
          />
        ))}
      </div>
      {audioUrl ? (
        <audio controls preload="none" className="mt-4 w-full">
          <source src={audioUrl} />
        </audio>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">Mock AI reference — upload playback in MVP</p>
      )}
    </article>
  );
}
