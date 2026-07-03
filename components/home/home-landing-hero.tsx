"use client";

import { AnimatedButton } from "@/components/animated-button";
import { HomeVocalistNameSearch } from "@/components/home/home-vocalist-name-search";

type HomeLandingHeroProps = {
  onFindByName: () => void;
};

export function HomeLandingHero({ onFindByName }: HomeLandingHeroProps) {
  return (
    <section className="relative shrink-0 overflow-hidden px-5 py-14 md:px-8 md:py-20 lg:py-24">
      <GlowOrb className="left-1/4 top-8 bg-purple-500/20" />
      <GlowOrb className="right-1/4 top-1/3 bg-cyan-500/10" />
      <GlowOrb className="bottom-4 left-1/3 bg-fuchsia-500/10" />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-vox-eyebrow text-purple-300/80">VoxBridge</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
          Find the real voice behind your track
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-vox-secondary md:text-lg">
          Match your AI vocal with a real human voice
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <AnimatedButton
            href="/search"
            variant="primary"
            className="w-full rounded-xl px-8 py-3.5 text-base font-semibold shadow-[0_0_40px_rgba(168,85,247,0.35)] sm:w-auto"
          >
            Upload AI Vocal
          </AnimatedButton>
          <AnimatedButton
            type="button"
            variant="secondary"
            onClick={onFindByName}
            className="w-full rounded-xl px-6 py-3 text-sm text-zinc-400 sm:w-auto"
          >
            Find vocalist by name
          </AnimatedButton>
        </div>

        <HomeVocalistNameSearch className="mx-auto mt-10 max-w-lg" />
      </div>
    </section>
  );
}

function GlowOrb({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute h-56 w-56 rounded-full blur-3xl ${className}`}
      aria-hidden
    />
  );
}
