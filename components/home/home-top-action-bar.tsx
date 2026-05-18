"use client";

import { AnimatedButton } from "@/components/animated-button";

type HomeTopActionBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  matchingMode: boolean;
};

export function HomeTopActionBar({
  searchQuery,
  onSearchChange,
  matchingMode,
}: HomeTopActionBarProps) {
  return (
    <header className="shrink-0 border-b border-white/10 bg-zinc-950/80 px-3 py-2.5 backdrop-blur-xl md:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm transition focus-within:border-cyan-400/35 focus-within:shadow-[0_0_22px_rgba(34,211,238,0.12)]">
          <SearchIcon />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search vocalists..."
            className="min-w-0 flex-1 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-500"
            aria-label="Search vocalists"
          />
        </label>

        <AnimatedButton
          href="/search"
          variant="primary"
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium"
        >
          Upload AI Vocal
        </AnimatedButton>

        {!matchingMode && (
          <AnimatedButton
            type="button"
            variant="secondary"
            className="shrink-0 rounded-lg px-4 py-2 text-sm"
            onClick={() => {
              document.getElementById("home-vocalist-list")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Browse Vocalists
          </AnimatedButton>
        )}
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-zinc-500 group-focus-within:text-cyan-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}
