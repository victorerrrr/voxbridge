"use client";

import { AnimatedButton } from "@/components/animated-button";
import type { UploadContext } from "@/lib/upload-context";

type HomeMatchingHeaderProps = {
  upload: UploadContext;
};

export function HomeMatchingHeader({ upload }: HomeMatchingHeaderProps) {
  const genre = upload.genreTags?.[0] || upload.vibe || "—";
  const mood = upload.moodTags?.[0] ?? "—";
  const bpm = upload.bpm?.trim() || "—";
  const key = upload.musicalKey?.trim() || "—";
  const trackName = upload.trackName?.trim() || upload.fileName || "Your track";

  return (
    <header className="shrink-0 border-b border-white/[0.06] px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-vox-eyebrow text-cyan-300/80">AI matching results</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white md:text-2xl">
            Matches for your AI vocal
          </h1>
        </div>
        <AnimatedButton
          href="/search"
          variant="secondary"
          className="shrink-0 rounded-lg px-4 py-2 text-sm"
        >
          Change upload
        </AnimatedButton>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm sm:grid-cols-5">
        <SummaryItem label="Track" value={trackName} />
        <SummaryItem label="Genre" value={genre} />
        <SummaryItem label="Mood" value={mood} />
        <SummaryItem label="BPM" value={bpm} />
        <SummaryItem label="Key" value={key} />
      </dl>
    </header>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-zinc-200">{value}</dd>
    </div>
  );
}
