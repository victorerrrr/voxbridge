import type { Vocalist } from "@/lib/mockVocalists";
import { getAvatarGradient, getVocalistInitials, getVocalistMatchReasons } from "@/lib/matching";
import { AnimatedButton } from "@/components/animated-button";

type MatchResultCardProps = {
  vocalist: Vocalist;
};

export function MatchResultCard({ vocalist }: MatchResultCardProps) {
  const reasons = getVocalistMatchReasons(vocalist);
  const initials = getVocalistInitials(vocalist.name);
  const gradient = getAvatarGradient(vocalist.id);

  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="mb-4 flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-lg font-semibold text-white shadow-[0_0_24px_rgba(168,85,247,0.25)]`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-white">{vocalist.name}</h2>
            <span className="rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-300">
              {vocalist.match}% match
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{vocalist.tagline}</p>
        </div>
      </div>

      <ul className="mb-4 space-y-1.5">
        {reasons.map((reason) => (
          <li key={reason} className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            {reason}
          </li>
        ))}
      </ul>

      <div className="mb-4 flex flex-wrap gap-2">
        {[...vocalist.genres, ...vocalist.tags].slice(0, 6).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900/60 p-3">
        <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Vocalist preview</p>
        <audio controls preload="none" className="w-full">
          <source src={vocalist.demoUrl} />
        </audio>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-zinc-400">
        <p>${vocalist.priceUsd} starting</p>
        <p>{vocalist.deliveryDays} day delivery</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatedButton
          href={`/compare/${vocalist.id}`}
          variant="secondary"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm"
        >
          Compare Voices
        </AnimatedButton>
        <AnimatedButton
          href={`/vocalists/${vocalist.id}`}
          variant="primary"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium"
        >
          View Profile
        </AnimatedButton>
      </div>
    </article>
  );
}
