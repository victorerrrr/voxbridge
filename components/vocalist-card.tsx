import type { Vocalist } from "@/lib/mockVocalists";
import { AnimatedButton } from "@/components/animated-button";

interface VocalistCardProps {
  vocalist: Vocalist;
}

export function VocalistCard({ vocalist }: VocalistCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{vocalist.name}</h2>
          <p className="mt-1 text-sm text-zinc-400">{vocalist.tagline}</p>
        </div>
        <span className="rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-300">
          {vocalist.match}% match
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {vocalist.genres.map((genre) => (
          <span
            key={genre}
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300"
          >
            {genre}
          </span>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between text-sm text-zinc-400">
        <p>${vocalist.priceUsd} starting</p>
        <p>{vocalist.deliveryDays} day delivery</p>
      </div>

      <AnimatedButton
        href={`/vocalists/${vocalist.id}`}
        variant="primary"
        className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium"
      >
        View Profile
      </AnimatedButton>
    </article>
  );
}
