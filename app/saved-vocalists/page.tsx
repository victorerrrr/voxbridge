"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getSavedVocalistIds, toggleSavedVocalist } from "@/components/home/saved-vocalists";
import { getAvatarGradient, getVocalistInitials } from "@/lib/matching";
import { mockVocalists } from "@/lib/mockVocalists";

export default function SavedVocalistsPage() {
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedVocalistIds());

  const savedVocalists = useMemo(
    () => mockVocalists.filter((vocalist) => savedIds.includes(vocalist.id)),
    [savedIds]
  );

  const onToggleSave = (id: string) => {
    setSavedIds(toggleSavedVocalist(id));
  };

  return (
    <InternalPageShell activeItem="saved-vocalists">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saved Vocalists</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Vocalists you saved from home and trending — stored in this browser.
          </p>
        </div>

        {savedVocalists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-zinc-950/40 px-6 py-12 text-center">
            <p className="text-zinc-300">No saved vocalists yet.</p>
            <p className="mt-2 text-sm text-zinc-500">Use Save on home or trending cards to build your shortlist.</p>
            <AnimatedButton
              href="/home"
              variant="secondary"
              className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm"
            >
              Browse home
            </AnimatedButton>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {savedVocalists.map((vocalist) => {
              const gradient = getAvatarGradient(vocalist.id);
              const initials = getVocalistInitials(vocalist.name);
              return (
                <li
                  key={vocalist.id}
                  className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 transition hover:border-purple-400/35"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sm font-semibold text-white`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/vocalists/${vocalist.id}`} className="font-medium text-white hover:text-purple-200">
                        {vocalist.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500">{vocalist.tagline}</p>
                      <p className="mt-2 text-xs text-zinc-400">{vocalist.genres.join(" · ")}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <AnimatedButton
                      href={`/vocalists/${vocalist.id}`}
                      variant="primary"
                      className="rounded-lg px-3 py-2 text-xs font-medium"
                    >
                      View profile
                    </AnimatedButton>
                    <AnimatedButton
                      type="button"
                      variant="secondary"
                      onClick={() => onToggleSave(vocalist.id)}
                      className="rounded-lg px-3 py-2 text-xs"
                    >
                      Remove
                    </AnimatedButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </InternalPageShell>
  );
}
