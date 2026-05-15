"use client";

import Link from "next/link";
import { AnimatedButton } from "@/components/animated-button";
import { MockAudioPlayer } from "@/components/mock-audio-player";
import { useProducerOrder } from "@/lib/hooks/use-producer-orders";
import {
  orderStatusLabel,
  submitFinalDelivery,
  submitPreview,
  submitRevision,
  type ProducerOrder,
} from "@/lib/orders";

type VocalistWorkspaceProps = {
  orderId: string;
};

export function VocalistWorkspace({ orderId }: VocalistWorkspaceProps) {
  const { order } = useProducerOrder(orderId);

  if (!order) return null;

  const canSubmitPreview = order.status === "in_progress" || order.status === "revision_requested";
  const canSubmitRevision = order.status === "revision_requested";
  const canSubmitFinal = order.status === "preview_approved";
  const waitingApproval = order.status === "preview_pending";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/vocalist/orders" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to requests
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-purple-300/80">Vocalist workspace</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {order.projectName || order.trackName}
          </h1>
          <p className="mt-2 text-zinc-400">Producer: {order.producerName || "Producer"}</p>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
            <h2 className="text-lg font-semibold">Project info</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-zinc-500">Brief</dt>
                <dd className="text-zinc-200">{order.description || order.vibe}</dd>
              </div>
              {order.reference && (
                <div>
                  <dt className="text-zinc-500">Reference file</dt>
                  <dd className="text-zinc-200">{order.reference}</dd>
                </div>
              )}
              {order.budget != null && (
                <div>
                  <dt className="text-zinc-500">Budget</dt>
                  <dd className="text-zinc-200">${order.budget}</dd>
                </div>
              )}
              <div>
                <dt className="text-zinc-500">Status note</dt>
                <dd className="text-zinc-200">{order.deliveryNote || "Work in progress."}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-5">
            <h2 className="text-lg font-semibold">AI vocal reference</h2>
            <p className="mt-1 text-sm text-zinc-400">Match tone and phrasing from the producer&apos;s AI preview.</p>
            <div className="mt-4">
              <MockAudioPlayer
                title={order.reference || `${order.projectName || order.trackName} reference`}
                subtitle="Producer AI vocal reference (mock)"
              />
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
            <h2 className="text-lg font-semibold">Chat</h2>
            <div className="mt-4 space-y-3">
              <ChatBubble
                from={order.producerName || "Producer"}
                message="Looking forward to your take — match the reference energy in the hook."
              />
              <ChatBubble from="You" message="On it. First preview coming soon." />
            </div>
            <input
              disabled
              placeholder="Messaging coming soon (mock)"
              className="mt-4 w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-500"
            />
          </article>

          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
            <h2 className="text-lg font-semibold">Your deliveries</h2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                {order.hasPreview ? "vocal-preview-v1.wav (uploaded)" : "vocal-preview-v1.wav (not yet)"}
              </li>
              <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                {order.hasStems ? "final-stems.zip (uploaded)" : "final-stems.zip (pending)"}
              </li>
            </ul>
          </article>
        </section>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
            <h2 className="text-lg font-semibold">Order status</h2>
            <p className="mt-2 text-sm text-zinc-300">{orderStatusLabel[order.status]}</p>
            <p className="mt-2 text-xs text-zinc-500">{order.deliveryNote || "Upload a preview when ready."}</p>
          </article>

          <article className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-5">
            <h2 className="text-lg font-semibold">Delivery workflow</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Upload preview, submit for approval, then deliver final stems when approved.
            </p>

            {waitingApproval && (
              <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                Preview submitted — waiting for producer approval.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <FileUploadPlaceholder label="Upload preview" />
              {canSubmitPreview && !canSubmitRevision && !waitingApproval && (
                <AnimatedButton
                  type="button"
                  variant="primary"
                  onClick={() => submitPreview(order.id)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium"
                >
                  Submit preview
                </AnimatedButton>
              )}
              {canSubmitRevision && (
                <>
                  <FileUploadPlaceholder label="Upload revision" />
                  <AnimatedButton
                    type="button"
                    variant="primary"
                    onClick={() => submitRevision(order.id)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium"
                  >
                    Upload revision
                  </AnimatedButton>
                </>
              )}
              <FileUploadPlaceholder label="Upload stems" />
              {canSubmitFinal && (
                <AnimatedButton
                  type="button"
                  variant="secondary"
                  onClick={() => submitFinalDelivery(order.id)}
                  className="rounded-lg px-4 py-2.5 text-sm"
                >
                  Deliver stems
                </AnimatedButton>
              )}
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProducerOrder["status"] }) {
  const styles: Record<ProducerOrder["status"], string> = {
    in_progress: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    preview_pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    revision_requested: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    preview_approved: "border-purple-400/30 bg-purple-500/10 text-purple-200",
    delivery_ready: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
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

function FileUploadPlaceholder({ label }: { label: string }) {
  return (
    <label className="flex cursor-pointer flex-col rounded-lg border border-dashed border-white/15 bg-zinc-900/50 px-3 py-3 text-sm text-zinc-400 transition hover:border-purple-400/40">
      <span>{label}</span>
      <span className="mt-1 text-xs text-zinc-500">Click to select (mock)</span>
      <input type="file" className="hidden" accept="audio/*,.zip" onChange={() => undefined} />
    </label>
  );
}
