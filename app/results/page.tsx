"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MatchResultCard } from "@/components/match-result-card";
import { UploadContextBanner } from "@/components/upload-context-banner";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { useUploadContext } from "@/lib/hooks/use-upload-context";
import { getRankedVocalists } from "@/lib/matching";

export default function ResultsPage() {
  const router = useRouter();
  const uploadContext = useUploadContext();

  useEffect(() => {
    if (uploadContext === null) {
      router.replace("/search");
    }
  }, [uploadContext, router]);

  if (uploadContext === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading matches...
      </main>
    );
  }

  const vocalists = getRankedVocalists();

  return (
    <InternalPageShell activeItem="upload">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">AI matching</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Matching Results</h1>
            <p className="mt-2 text-zinc-400">
              Ranked vocalists for your brief — mock scoring from tone, phrasing, and tags.
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

        <UploadContextBanner context={uploadContext} />

        <section className="grid gap-4 md:grid-cols-2">
          {vocalists.map((vocalist) => (
            <MatchResultCard key={vocalist.id} vocalist={vocalist} />
          ))}
        </section>
      </div>
    </InternalPageShell>
  );
}
