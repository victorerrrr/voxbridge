"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { VocalistWorkspace } from "@/components/vocalist-workspace";
import { getStoredUser, type UserRole } from "@/lib/auth";
import { useProducerOrder } from "@/lib/hooks/use-producer-orders";
import {
  approveDelivery,
  markOrderCompleted,
  orderStatusLabel,
  requestRevision,
  type ProducerOrder,
} from "@/lib/orders";
import { addVocalistReview } from "@/lib/reviews";
import { getVocalistById } from "@/lib/mockVocalists";
import { isVocalistWorkspaceSide } from "@/lib/workspace-url";

export default function WorkspacePage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const authUser = getStoredUser();
  const role: UserRole | null = authUser?.isAuthenticated ? authUser.role : null;
  const { order, ready } = useProducerOrder(params.orderId);
  const vocalistSide = isVocalistWorkspaceSide(searchParams) || role === "vocalist";

  useEffect(() => {
    if (!authUser?.isAuthenticated) {
      router.replace("/signup");
    }
  }, [authUser?.isAuthenticated, router]);

  useEffect(() => {
    if (!ready || !role) return;
    if (!order) {
      const dest = role === "vocalist" ? "/vocalist/orders" : "/dashboard?tab=projects";
      router.replace(dest);
    }
  }, [order, ready, role, router]);

  if (!authUser?.isAuthenticated || !ready || !role) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading workspace...
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading workspace...
      </main>
    );
  }

  if (vocalistSide) {
    return (
      <InternalPageShell activeItem="workspace">
        <VocalistWorkspace orderId={params.orderId} />
      </InternalPageShell>
    );
  }

  const vocalist = getVocalistById(order.vocalistId);
  const isCompleted = order.status === "completed";

  const onComplete = () => {
    markOrderCompleted(order.id);
    addVocalistReview({
      orderId: order.id,
      vocalistId: order.vocalistId,
      producerName: "You",
      rating,
      comment: comment.trim() || "Great collaboration!",
    });
    setShowReview(false);
  };

  return (
    <InternalPageShell activeItem="projects">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/dashboard?tab=projects" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Back to projects
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Producer workspace</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{order.trackName}</h1>
            <p className="mt-2 text-zinc-400">with {order.vocalistName}</p>
          </div>
          <StatusBadge status={order.status} />
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold">Project info</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Vibe brief</dt>
                  <dd className="text-zinc-200">{order.vibe}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Revisions</dt>
                  <dd className="text-zinc-200">{order.revisionCount}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Status note</dt>
                  <dd className="text-zinc-200">{order.deliveryNote || "Work in progress."}</dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold">Chat</h2>
              <div className="mt-4 space-y-3">
                <ChatBubble from="You" message="Hey! Excited to work on this topline — attached the AI reference." />
                <ChatBubble
                  from={order.vocalistName}
                  message="Got it. I'll match the phrasing in the pre-chorus and send a first take in 48h."
                />
              </div>
              <input
                disabled
                placeholder="Messaging coming soon (mock)"
                className="mt-4 w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-500"
              />
            </article>

            <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold">Files</h2>
              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                  ai-reference-demo.mp3 (uploaded)
                </li>
                <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                  {order.hasPreview
                    ? "vocal-preview-v1.wav (received)"
                    : "vocal-preview-v1.wav (pending)"}
                </li>
                <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                  {order.hasStems
                    ? "final-stems.zip (delivered)"
                    : "final-stems.zip (pending delivery)"}
                </li>
              </ul>
            </article>
          </section>

          <aside className="space-y-4">
            <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
              <h2 className="text-lg font-semibold">Vocalist</h2>
              {vocalist ? (
                <>
                  <p className="mt-2 font-medium text-white">{vocalist.name}</p>
                  <p className="text-sm text-zinc-400">{vocalist.tagline}</p>
                  <AnimatedButton
                    href={`/vocalists/${vocalist.id}`}
                    variant="secondary"
                    className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm"
                  >
                    View profile
                  </AnimatedButton>
                </>
              ) : (
                <>
                  <p className="mt-2 font-medium text-white">{order.vocalistName}</p>
                  <AnimatedButton
                    href={`/vocalists/${order.vocalistId}`}
                    variant="secondary"
                    className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm"
                  >
                    View profile
                  </AnimatedButton>
                </>
              )}
            </article>

            <article className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-5">
              <h2 className="text-lg font-semibold">Delivery workflow</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Approve previews, request revisions, then complete and leave a review.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <AnimatedButton
                  type="button"
                  variant="secondary"
                  disabled={
                    isCompleted ||
                    (order.status !== "preview_pending" && order.status !== "delivery_ready")
                  }
                  onClick={() => requestRevision(order.id)}
                  className="rounded-lg px-4 py-2.5 text-sm disabled:opacity-40"
                >
                  Request revision
                </AnimatedButton>
                <AnimatedButton
                  type="button"
                  variant="secondary"
                  disabled={isCompleted || order.status !== "preview_pending"}
                  onClick={() => approveDelivery(order.id)}
                  className="rounded-lg px-4 py-2.5 text-sm disabled:opacity-40"
                >
                  Approve preview
                </AnimatedButton>
                <AnimatedButton
                  type="button"
                  variant="primary"
                  disabled={isCompleted || order.status !== "delivery_ready"}
                  onClick={() => setShowReview(true)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40"
                >
                  Mark completed & review
                </AnimatedButton>
              </div>
              {isCompleted && (
                <p className="mt-4 text-sm font-medium text-emerald-300">PROJECT COMPLETED</p>
              )}
            </article>
          </aside>
        </div>

        {showReview && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6">
              <h3 className="text-lg font-semibold">Rate {order.vocalistName}</h3>
              <p className="mt-1 text-sm text-zinc-400">Your review builds their reputation on VoxBridge.</p>
              <label className="mt-4 block text-sm text-zinc-300">
                Rating (1–5)
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment"
                className="mt-3 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
              />
              <div className="mt-4 flex gap-2">
                <AnimatedButton
                  type="button"
                  variant="primary"
                  onClick={onComplete}
                  className="rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Submit review
                </AnimatedButton>
                <AnimatedButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowReview(false)}
                  className="rounded-lg px-4 py-2 text-sm"
                >
                  Cancel
                </AnimatedButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </InternalPageShell>
  );
}

function StatusBadge({ status }: { status: ProducerOrder["status"] }) {
  const styles: Record<ProducerOrder["status"], string> = {
    in_progress: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    preview_pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    revision_requested: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    preview_approved: "border-purple-400/30 bg-purple-500/10 text-purple-200",
    delivery_ready: "border-purple-400/30 bg-purple-500/10 text-purple-200",
    completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  };

  return (
    <span className={`rounded-full border px-4 py-1.5 text-sm font-medium ${styles[status]}`}>
      {orderStatusLabel[status]}
    </span>
  );
}

function ChatBubble({ from, message }: { from: string; message: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
      <p className="text-xs text-zinc-500">{from}</p>
      <p className="mt-1 text-sm text-zinc-200">{message}</p>
    </div>
  );
}
