"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { InternalPageShell } from "@/components/internal-page-shell";
import { VocalistRequestCard } from "@/components/vocalist-request-card";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { useVocalistRequestsForVocalist } from "@/lib/hooks/use-vocalist-requests";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";
import {
  acceptVocalistRequest,
  declineVocalistRequest,
  ensureVocalistRequestsSeeded,
} from "@/lib/vocalist-requests";
import { vocalistWorkspaceUrl } from "@/lib/workspace-url";

const PENDING_STATUSES = ["pending"] as const;
const ACCEPTED_STATUSES = ["accepted"] as const;
const DECLINED_STATUSES = ["declined"] as const;

export default function VocalistOrdersPage() {
  return (
    <InternalPageShell activeItem="orders">
      <VocalistOrdersContent />
    </InternalPageShell>
  );
}

function VocalistOrdersContent() {
  const router = useRouter();
  const { user, isReady } = useClientAuth();
  const vocalistId = user ? vocalistIdFromEmail(user.email) : "";

  useEffect(() => {
    if (!isReady) return;
    if (!user || user.role !== "vocalist") {
      router.replace("/signup?role=vocalist");
      return;
    }
    ensureVocalistRequestsSeeded();
  }, [router, user, isReady]);

  const pending = useVocalistRequestsForVocalist(vocalistId, [...PENDING_STATUSES]);
  const accepted = useVocalistRequestsForVocalist(vocalistId, [...ACCEPTED_STATUSES]);
  const declined = useVocalistRequestsForVocalist(vocalistId, [...DECLINED_STATUSES]);

  if (!isReady || !user || user.role !== "vocalist") {
    return <p className="text-sm text-zinc-400">Loading orders...</p>;
  }

  const hasAny = pending.length + accepted.length + declined.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-vox-eyebrow">Incoming work</p>
        <h1 className="text-3xl font-semibold tracking-tight">Producer requests</h1>
        <p className="mt-2 text-vox-secondary">
          Review briefs before accepting. Accepted requests stay here and open in your workspace.
        </p>
      </header>

      {!hasAny ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-zinc-300">
          No requests yet. Check back after completing your profile and tags.
        </div>
      ) : (
        <>
          <RequestSection title="Pending" count={pending.length} emptyHint="No pending requests right now.">
            {pending.map((request) => (
              <VocalistRequestCard
                key={request.id}
                request={request}
                onAccept={() => {
                  acceptVocalistRequest(request.id).then((order) => {
                    if (order) router.push(vocalistWorkspaceUrl(order.id));
                  });
                }}
                onDecline={() => declineVocalistRequest(request.id)}
              />
            ))}
          </RequestSection>

          <RequestSection title="Accepted" count={accepted.length} emptyHint="Accepted orders appear here with workspace access.">
            {accepted.map((request) => (
              <VocalistRequestCard key={request.id} request={request} />
            ))}
          </RequestSection>

          {declined.length > 0 && (
            <RequestSection title="Declined" count={declined.length} muted>
              {declined.map((request) => (
                <VocalistRequestCard key={request.id} request={request} />
              ))}
            </RequestSection>
          )}
        </>
      )}
    </div>
  );
}

function RequestSection({
  title,
  count,
  emptyHint,
  muted,
  children,
}: {
  title: string;
  count: number;
  emptyHint?: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={muted ? "opacity-75" : undefined}>
      <h2 className="text-vox-label text-zinc-400">
        {title} <span className="text-zinc-600">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500">
          {emptyHint}
        </p>
      ) : (
        <div className="mt-3 space-y-4">{children}</div>
      )}
    </section>
  );
}
