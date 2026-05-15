"use client";

import { AnimatedButton } from "@/components/animated-button";
import { usePendingVocalistRequests } from "@/lib/hooks/use-vocalist-requests";
import { ensureVocalistRequestsSeeded } from "@/lib/vocalist-requests";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";
import { useEffect } from "react";

type HomeIncomingRequestsProps = {
  email: string;
};

export function HomeIncomingRequests({ email }: HomeIncomingRequestsProps) {
  const vocalistId = vocalistIdFromEmail(email);
  const pending = usePendingVocalistRequests(vocalistId).slice(0, 3);

  useEffect(() => {
    ensureVocalistRequestsSeeded();
  }, []);

  if (pending.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Incoming requests</h2>
        <AnimatedButton href="/vocalist/orders" variant="secondary" className="rounded-lg px-2.5 py-1 text-[10px]">
          View all
        </AnimatedButton>
      </div>
      <div className="grid gap-2">
        {pending.map((request) => (
          <article
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 transition hover:border-amber-300/35"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{request.projectName}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {request.producerName} · ${request.budget}
              </p>
            </div>
            <AnimatedButton
              href={`/vocalist/requests/${request.id}`}
              variant="primary"
              className="rounded-lg px-3 py-2 text-xs font-medium"
            >
              Open
            </AnimatedButton>
          </article>
        ))}
      </div>
    </section>
  );
}
