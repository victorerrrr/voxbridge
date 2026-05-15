"use client";

import { AnimatedButton } from "@/components/animated-button";
import { getRankedVocalists } from "@/lib/matching";

export function HomeQuickMatches() {
  const matches = getRankedVocalists().slice(0, 2);
  if (matches.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Quick matches</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {matches.map((vocalist) => (
          <article
            key={vocalist.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-3 transition hover:border-cyan-400/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{vocalist.name}</p>
              <p className="mt-0.5 text-xs text-purple-300">{vocalist.match}% match</p>
            </div>
            <AnimatedButton
              href={`/compare/${vocalist.id}`}
              variant="secondary"
              className="shrink-0 rounded-lg px-3 py-2 text-xs"
            >
              Compare
            </AnimatedButton>
          </article>
        ))}
      </div>
    </section>
  );
}
