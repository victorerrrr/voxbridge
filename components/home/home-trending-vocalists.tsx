"use client";

import { useEffect, useState } from "react";
import { AnimatedButton } from "@/components/animated-button";
import { useHomeAudio } from "@/components/home/home-audio-provider";
import { getSavedVocalistIds, toggleSavedVocalist } from "@/components/home/saved-vocalists";
import { getAvatarGradient, getVocalistInitials } from "@/lib/matching";
import { mockVocalists } from "@/lib/mockVocalists";

export function HomeTrendingVocalists() {
  const { playTrack, track, isPlaying, activeSide } = useHomeAudio();
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    setSavedIds(getSavedVocalistIds());
  }, []);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Trending vocalists</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {mockVocalists.map((vocalist) => {
          const previewActive =
            track?.id === vocalist.id && isPlaying && activeSide === "vocal";
          const saved = savedIds.includes(vocalist.id);
          const gradient = getAvatarGradient(vocalist.id);
          const initials = getVocalistInitials(vocalist.name);

          return (
            <article
              key={vocalist.id}
              className="w-[min(100%,17rem)] shrink-0 rounded-xl border border-white/10 bg-zinc-950/70 p-3 transition hover:border-purple-400/35 hover:shadow-[0_0_24px_rgba(168,85,247,0.15)]"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sm font-semibold text-white`}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{vocalist.name}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{vocalist.genres.join(" · ")}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  playTrack(
                    {
                      id: vocalist.id,
                      title: vocalist.name,
                      aiLabel: "AI reference",
                      vocalLabel: vocalist.tagline,
                      vocalUrl: vocalist.demoUrl,
                    },
                    "vocal"
                  )
                }
                className={`mt-3 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                  previewActive
                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                    : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                }`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px]">
                  {previewActive ? "❚❚" : "▶"}
                </span>
                Preview demo
              </button>

              <div className="mt-3 flex gap-2">
                <AnimatedButton
                  href={`/vocalists/${vocalist.id}`}
                  variant="primary"
                  className="flex-1 rounded-lg px-2 py-2 text-xs font-medium"
                >
                  View profile
                </AnimatedButton>
                <AnimatedButton
                  type="button"
                  variant="secondary"
                  onClick={() => setSavedIds(toggleSavedVocalist(vocalist.id))}
                  className="rounded-lg px-2.5 py-2 text-xs"
                >
                  {saved ? "Saved" : "Save"}
                </AnimatedButton>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
