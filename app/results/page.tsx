import { VocalistCard } from "@/components/vocalist-card";
import { mockVocalists } from "@/lib/mockVocalists";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";

export default function ResultsPage() {
  return (
    <InternalPageShell activeItem="explore">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Matching Vocalists</h1>
            <p className="mt-2 text-zinc-400">
              Best matches based on your uploaded vocal reference (mock scoring).
            </p>
          </div>
          <AnimatedButton
            href="/search"
            variant="secondary"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm"
          >
            Upload another reference
          </AnimatedButton>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {mockVocalists.map((vocalist) => (
            <VocalistCard key={vocalist.id} vocalist={vocalist} />
          ))}
        </section>
      </div>
    </InternalPageShell>
  );
}
