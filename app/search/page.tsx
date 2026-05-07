"use client";

import { useState } from "react";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";

export default function SearchPage() {
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <InternalPageShell activeItem="explore">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Upload Vocal Reference</h1>
        <p className="mt-3 text-zinc-400">
          Drop your AI vocal draft to get matching vocalists from our MVP catalog.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
          <label
            htmlFor="referenceFile"
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-zinc-900/70 px-6 py-12 text-center transition hover:border-purple-400/60 hover:bg-zinc-900"
          >
            <span className="text-lg font-medium">Drop audio here or click to upload</span>
            <span className="mt-2 text-sm text-zinc-400">
              MP3, WAV, or M4A up to 25MB (mock upload)
            </span>
          </label>
          <input
            id="referenceFile"
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          />

          <p className="mt-3 text-sm text-zinc-400">
            {fileName ? `Selected file: ${fileName}` : "No file selected yet"}
          </p>

          <div className="mt-6 grid gap-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Track name"
              className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Describe desired vibe, language, vocal tone..."
              className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <AnimatedButton
              href="/results"
              variant="primary"
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              Find Matches
            </AnimatedButton>
            <AnimatedButton
              href="/become-vocalist"
              variant="secondary"
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm"
            >
              Become a Vocalist
            </AnimatedButton>
          </div>
        </div>
      </div>
    </InternalPageShell>
  );
}
