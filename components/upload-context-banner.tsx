"use client";

import type { UploadContext } from "@/lib/upload-context";

type UploadContextBannerProps = {
  context: UploadContext;
};

export function UploadContextBanner({ context }: UploadContextBannerProps) {
  const tags = [...context.genreTags, ...context.voiceTags, ...context.moodTags];

  return (
    <section className="mb-8 rounded-2xl border border-purple-400/25 bg-gradient-to-r from-purple-500/10 via-zinc-950/80 to-cyan-500/10 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-purple-200/80">Your brief</p>
      <h2 className="mt-1 text-xl font-semibold text-white">
        {context.trackName || "Untitled track"}
      </h2>
      {context.vibe && <p className="mt-2 text-sm text-zinc-300">{context.vibe}</p>}
      <BriefMeta context={context} tags={tags} />
    </section>
  );
}

function BriefMeta({ context, tags }: { context: UploadContext; tags: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
      {context.fileName && (
        <span className="rounded-full border border-white/10 px-2.5 py-1">
          File: {context.fileName}
        </span>
      )}
      {context.bpm && (
        <span className="rounded-full border border-white/10 px-2.5 py-1">BPM {context.bpm}</span>
      )}
      {context.musicalKey && (
        <span className="rounded-full border border-white/10 px-2.5 py-1">Key {context.musicalKey}</span>
      )}
      {tags.map((tag) => (
        <span key={tag} className="rounded-full border border-white/10 px-2.5 py-1 text-zinc-300">
          {tag}
        </span>
      ))}
    </div>
  );
}
