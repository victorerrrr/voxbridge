"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { InternalPageShell } from "@/components/internal-page-shell";
import { AnimatedButton } from "@/components/animated-button";
import { createVocalistRequest } from "@/lib/vocalist-requests";

export default function RequestVocalistPage() {
  return (
    <InternalPageShell activeItem="explore">
      <RequestVocalistContent />
    </InternalPageShell>
  );
}

function RequestVocalistContent() {
  const params = useParams<{ vocalistId: string }>();
  const router = useRouter();
  const vocalistId = params.vocalistId;

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await createVocalistRequest(vocalistId, {
        projectName: projectName.trim(),
        description: description.trim(),
        budget: budget ? Number(budget) : undefined,
        reference: reference.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-zinc-950/60 p-8 text-center">
        <h1 className="text-2xl font-semibold">Request sent</h1>
        <p className="mt-3 text-vox-secondary">
          The vocalist will review your project and respond soon. You can track this request
          from your workspace.
        </p>
        <AnimatedButton
          href="/workspace"
          variant="primary"
          className="mt-6 inline-flex rounded-lg px-5 py-2.5 text-sm font-medium"
        >
          Go to workspace
        </AnimatedButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Request this vocalist</h1>
        <p className="mt-1 text-vox-secondary">
          Describe your project. The vocalist will review and accept before any work begins.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-6">
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">Project name</span>
          <input
            required
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. Midnight Drive"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">What do you need?</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Genre, mood, what kind of vocal take you're looking for..."
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">Budget (USD, optional)</span>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 200"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">Reference link (optional)</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Link to a demo, AI reference, or similar track"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
          />
        </label>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <AnimatedButton
          type="submit"
          variant="primary"
          className="inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
        >
          {submitting ? "Sending..." : "Send request"}
        </AnimatedButton>
      </form>
    </div>
  );
}
