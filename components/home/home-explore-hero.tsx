"use client";

import { AnimatedButton } from "@/components/animated-button";
import { useHomeStats } from "@/lib/hooks/use-home-stats";
import type { UserRole } from "@/lib/auth";

type HomeExploreHeroProps = {
  role: UserRole;
  email: string;
  onBrowse: () => void;
};

export function HomeExploreHero({ role, email, onBrowse }: HomeExploreHeroProps) {
  const stats = useHomeStats(role, email);

  return (
    <section className="shrink-0 border-b border-white/[0.06] px-4 py-6 md:px-6 md:py-8">
      <h1 className="max-w-2xl text-xl font-bold tracking-tight text-white md:text-2xl">
        Find the right real voice for your track
      </h1>
      <p className="mt-2 max-w-xl text-vox-secondary">
        Upload an AI vocal, browse real vocalists, compare voices, and start a project.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <AnimatedButton
          href="/search"
          variant="primary"
          className="rounded-lg px-5 py-2.5 text-sm font-medium shadow-[0_0_28px_rgba(168,85,247,0.25)]"
        >
          Upload AI Vocal
        </AnimatedButton>
        <AnimatedButton
          type="button"
          variant="secondary"
          className="rounded-lg px-5 py-2.5 text-sm"
          onClick={onBrowse}
        >
          Browse Vocalists
        </AnimatedButton>
      </div>

      <ul className="mt-6 grid gap-2 sm:grid-cols-3">
        <StatCard label="Active projects" value={stats.activeProjects} />
        <StatCard label="Saved vocalists" value={stats.savedVocalists} />
        <StatCard label="Recent requests" value={stats.recentRequests} />
      </ul>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{value}</p>
    </li>
  );
}
