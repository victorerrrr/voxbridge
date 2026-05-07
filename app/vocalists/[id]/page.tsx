import Link from "next/link";
import { notFound } from "next/navigation";
import { getVocalistById } from "@/lib/mockVocalists";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";

interface VocalistPageProps {
  params: Promise<{ id: string }>;
}

export default async function VocalistPage({ params }: VocalistPageProps) {
  const { id } = await params;
  const vocalist = getVocalistById(id);

  if (!vocalist) {
    notFound();
  }

  return (
    <InternalPageShell activeItem="results">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-zinc-950/60 p-6 md:p-8">
        <Link href="/results" className="text-sm text-zinc-400 transition hover:text-zinc-200">
          ← Back to results
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{vocalist.name}</h1>
        <p className="mt-2 text-zinc-400">{vocalist.tagline}</p>

        <div className="mt-6 grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-3">
            <p className="text-zinc-500">Starting from</p>
            <p className="mt-1 text-base font-medium text-white">${vocalist.priceUsd}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-3">
            <p className="text-zinc-500">Delivery</p>
            <p className="mt-1 text-base font-medium text-white">{vocalist.deliveryDays} days</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-3">
            <p className="text-zinc-500">Location</p>
            <p className="mt-1 text-base font-medium text-white">{vocalist.location}</p>
          </div>
        </div>

        <p className="mt-6 leading-relaxed text-zinc-300">{vocalist.description}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {vocalist.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="mb-3 text-sm text-zinc-400">Demo</p>
          <audio controls className="w-full">
            <source src={vocalist.demoUrl} />
            Your browser does not support audio playback.
          </audio>
        </div>

        <AnimatedButton
          variant="primary"
          className="mt-8 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
        >
          Request This Vocalist
        </AnimatedButton>
      </div>
    </InternalPageShell>
  );
}
