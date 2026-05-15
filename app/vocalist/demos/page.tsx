"use client";

import { FormEvent, useState } from "react";
import { AnimatedButton } from "@/components/animated-button";
import { VocalistFlowShell } from "@/components/vocalist-flow-shell";
import {
  addVocalistDemo,
  getVocalistProfileByEmail,
  type VocalistDemo,
} from "@/lib/vocalist-profile";
import { useVocalistGuard } from "@/lib/use-vocalist-guard";

export default function VocalistDemosPage() {
  const user = useVocalistGuard({ requireProfile: true });
  const profile = user ? getVocalistProfileByEmail(user.email) : undefined;
  const [demos, setDemos] = useState<VocalistDemo[]>(profile?.demos ?? []);
  const [trackName, setTrackName] = useState("");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
        Loading...
      </main>
    );
  }

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileName(file?.name ?? "");
  };

  const onAddDemo = (event: FormEvent) => {
    event.preventDefault();
    if (!trackName.trim() || !fileName) return;

    const next = addVocalistDemo(user.email, {
      trackName: trackName.trim(),
      description: description.trim(),
      fileName,
    });
    setDemos(next.demos);
    setTrackName("");
    setDescription("");
    setFileName("");
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2";

  return (
    <VocalistFlowShell
      activeItem="samples"
      title="Upload demos"
      subtitle="Add 1–3 vocal samples so producers can hear your tone."
    >
      <form onSubmit={onAddDemo} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">Audio file</label>
          <input
            type="file"
            accept="audio/*"
            onChange={onFileChange}
            className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-500/20 file:px-3 file:py-2 file:text-purple-100"
          />
          {fileName && <p className="mt-2 text-xs text-zinc-500">{fileName} (placeholder upload)</p>}
        </div>
        <input
          required
          value={trackName}
          onChange={(e) => setTrackName(e.target.value)}
          placeholder="Track name"
          className={inputClass}
        />
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          className={inputClass}
        />
        <AnimatedButton
          type="submit"
          variant="secondary"
          className="inline-flex rounded-lg px-4 py-2 text-sm"
        >
          Add demo
        </AnimatedButton>
      </form>

      {demos.length > 0 && (
        <ul className="mt-6 space-y-2 border-t border-white/10 pt-6">
          {demos.map((demo) => (
            <li
              key={demo.id}
              className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm"
            >
              <p className="font-medium text-zinc-100">{demo.trackName}</p>
              <p className="text-xs text-zinc-500">{demo.fileName}</p>
              {demo.description && <p className="mt-1 text-xs text-zinc-400">{demo.description}</p>}
            </li>
          ))}
        </ul>
      )}

      <AnimatedButton
        href="/vocalist/tags"
        variant="primary"
        className="mt-6 inline-flex rounded-lg px-5 py-2.5 text-sm font-medium"
      >
        Continue to tags
      </AnimatedButton>
    </VocalistFlowShell>
  );
}
