"use client";

import Link from "next/link";
import { AnimatedButton } from "@/components/animated-button";

export function HomeTopActionBar() {
  return (
    <header className="shrink-0 border-b border-white/10 bg-zinc-950/80 px-3 py-2.5 backdrop-blur-xl md:px-4">
      <div className="flex items-center gap-2">
        <Link
          href="/search"
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-zinc-400 transition hover:border-cyan-400/35 hover:text-zinc-200 hover:shadow-[0_0_22px_rgba(34,211,238,0.12)]"
        >
          <SearchIcon />
          <span className="truncate">Describe voice…</span>
        </Link>

        <AnimatedButton
          href="/search"
          variant="primary"
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium"
        >
          Upload AI Vocal
        </AnimatedButton>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-cyan-300"
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
