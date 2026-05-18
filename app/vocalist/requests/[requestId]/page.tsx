"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { MockAudioPlayer } from "@/components/mock-audio-player";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { useVocalistRequest } from "@/lib/hooks/use-vocalist-requests";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";
import {
  acceptVocalistRequest,
  declineVocalistRequest,
  ensureVocalistRequestsSeeded,
  vocalistRequestStatusLabel,
  type VocalistRequest,
} from "@/lib/vocalist-requests";
import { vocalistWorkspaceUrl } from "@/lib/workspace-url";

export default function VocalistRequestDetailPage() {
  const params = useParams<{ requestId: string }>();

  return (
    <InternalPageShell activeItem="orders">
      <VocalistRequestDetailContent requestId={params.requestId} />
    </InternalPageShell>
  );
}

function VocalistRequestDetailContent({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { user, isReady } = useClientAuth();
  const vocalistId = user ? vocalistIdFromEmail(user.email) : "";
  const request = useVocalistRequest(requestId);

  useEffect(() => {
    if (!isReady) return;
    if (!user || user.role !== "vocalist") {
      router.replace("/signup?role=vocalist");
      return;
    }
    ensureVocalistRequestsSeeded();
  }, [router, user, isReady]);

  useEffect(() => {
    if (!isReady || !request || !vocalistId) return;
    if (request.vocalistId !== vocalistId) {
      router.replace("/vocalist/orders");
    }
  }, [request, vocalistId, router, isReady]);

  if (!isReady || !user || user.role !== "vocalist") {
    return <p className="text-sm text-zinc-400">Loading...</p>;
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-zinc-400">Request not found.</p>
        <AnimatedButton href="/vocalist/orders" variant="secondary" className="rounded-lg px-4 py-2 text-sm">
          Back to requests
        </AnimatedButton>
      </div>
    );
  }

  const onAccept = () => {
    const order = acceptVocalistRequest(request.id);
    if (order) router.push(vocalistWorkspaceUrl(order.id));
  };

  const onDecline = () => {
    declineVocalistRequest(request.id);
    router.push("/vocalist/orders");
  };

  const isPending = request.status === "pending";
  const isAccepted = request.status === "accepted";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/vocalist/orders" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Back to requests
        </Link>

        <header className="space-y-2">
          <p className="text-vox-eyebrow">Producer request</p>
          <h1 className="text-3xl font-semibold tracking-tight">{request.projectName}</h1>
          <p className="text-vox-secondary">
            from <span className="text-zinc-200">{request.producerName}</span>
          </p>
          <span className="inline-flex rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300">
            {vocalistRequestStatusLabel[request.status]}
          </span>
        </header>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 space-y-4">
          <div>
            <h2 className="text-vox-label normal-case tracking-normal text-zinc-400">What the producer wants</h2>
            <p className="mt-2 text-vox-secondary leading-relaxed">{request.brief || request.description}</p>
          </div>
          {request.description && request.brief !== request.description && (
            <div>
              <h2 className="text-sm font-medium text-zinc-400">Description</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{request.description}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
          <h2 className="text-lg font-semibold">Tags & tempo</h2>
          <TagGroups request={request} />
          {(request.bpm || request.musicalKey) && (
            <p className="mt-4 text-sm text-zinc-300">
              {request.bpm && <span>BPM {request.bpm}</span>}
              {request.bpm && request.musicalKey && <span className="mx-2 text-zinc-600">·</span>}
              {request.musicalKey && <span>Key {request.musicalKey}</span>}
            </p>
          )}
        </section>

        {request.referenceLinks.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
            <h2 className="text-lg font-semibold">Reference links</h2>
            <ul className="mt-3 space-y-2">
              {request.referenceLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-cyan-300 hover:text-cyan-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
          <h2 className="text-lg font-semibold">AI vocal preview</h2>
          <p className="mt-1 text-sm text-zinc-400">Producer reference for tone and phrasing (mock player).</p>
          <div className="mt-4">
            <MockAudioPlayer title={request.reference || request.projectName} />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
          <h2 className="text-lg font-semibold">Budget & deadline</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Budget</dt>
              <dd className="text-lg font-semibold text-emerald-200">${request.budget}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Deadline</dt>
              <dd className="text-zinc-200">{request.deadline || "Flexible (mock)"}</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-wrap gap-2">
          {isPending && (
            <>
              <AnimatedButton
                type="button"
                variant="primary"
                onClick={onAccept}
                className="rounded-lg px-5 py-2.5 text-sm font-medium"
              >
                Accept order
              </AnimatedButton>
              <AnimatedButton
                type="button"
                variant="secondary"
                onClick={onDecline}
                className="rounded-lg px-5 py-2.5 text-sm"
              >
                Decline request
              </AnimatedButton>
            </>
          )}
          {isAccepted && request.orderId && (
            <AnimatedButton
              href={vocalistWorkspaceUrl(request.orderId)}
              variant="primary"
              className="rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              Go to workspace
            </AnimatedButton>
          )}
          <AnimatedButton href="/vocalist/orders" variant="secondary" className="rounded-lg px-5 py-2.5 text-sm">
            Back to requests
          </AnimatedButton>
        </div>
    </div>
  );
}

function TagGroups({ request }: { request: VocalistRequest }) {
  const groups = [
    { label: "Genre", tags: request.genreTags },
    { label: "Mood", tags: request.moodTags },
    { label: "Voice", tags: request.voiceTags },
  ].filter((g) => g.tags.length > 0);

  if (groups.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500">No tags provided.</p>;
  }

  return (
    <div className="mt-4 space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{group.label}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {group.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-zinc-300">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
