"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatedButton } from "@/components/animated-button";
import { AdminWorkspaceShell } from "@/components/admin-workspace-shell";
import { InternalPageShell } from "@/components/internal-page-shell";
import {
  FileUploadPlaceholder,
  OrderWorkspaceLayout,
  WorkspaceChat,
  WorkspacePanel,
} from "@/components/order-workspace-layout";
import { VocalistWorkspace } from "@/components/vocalist-workspace";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { useProducerOrder } from "@/lib/hooks/use-producer-orders";
import { approveDelivery, markOrderCompleted, orderStatusLabel, requestRevision } from "@/lib/orders";
import { addVocalistReview } from "@/lib/reviews";
import { MockAudioPlayer } from "@/components/mock-audio-player";
import { isVocalistWorkspaceSide } from "@/lib/workspace-url";

export default function WorkspacePage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const { user, role, isAdmin, isReady, isAuthenticated } = useClientAuth();
  const { order, ready } = useProducerOrder(params.orderId);
  const isAdminView = searchParams.get("admin") === "1" && isAdmin;
  const vocalistSide =
    !isAdminView &&
    (isVocalistWorkspaceSide(searchParams) || (isReady && role === "vocalist"));

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/signup");
    }
  }, [isReady, isAuthenticated, router]);

  useEffect(() => {
    if (!isReady || !ready) return;
    if (!order) {
      const dest = isAdminView
        ? "/admin/workspaces"
        : role === "vocalist"
          ? "/vocalist/orders"
          : "/workspace";
      router.replace(dest);
    }
  }, [order, ready, role, isReady, isAdminView, router]);

  if (!isReady || !isAuthenticated || !ready) {
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
      <InternalPageShell activeItem="workspace" contentVariant="workspace">
        <VocalistWorkspace orderId={params.orderId} />
      </InternalPageShell>
    );
  }

  const isCompleted = order.status === "completed";

  const onComplete = async () => {
    setReviewError(null);
    setSubmittingReview(true);
    try {
      await markOrderCompleted(order.id);
      if (user) {
        await addVocalistReview({
          orderId: order.id,
          vocalistId: order.vocalistId,
          producerId: user.id,
          rating,
          comment: comment.trim() || "Great collaboration!",
        });
      }
      setShowReview(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit review.";
      setReviewError(message);
      alert(`Ошибка отзыва: ${message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  const canComplete = !isCompleted && order.status === "delivery_ready";

  const workspaceBody = (
    <>
      <OrderWorkspaceLayout
        backHref={isAdminView ? "/admin/workspaces" : "/workspace"}
        backLabel={isAdminView ? "Workspaces" : "Workspace"}
        order={order}
        counterpartyLabel="Vocalist"
        counterpartyName={order.vocalistName}
        leftExtra={
          <AnimatedButton
            href={`/vocalists/${order.vocalistId}`}
            variant="secondary"
            className="mt-2 inline-flex w-full justify-center rounded-lg px-3 py-2 text-xs"
          >
            View profile
          </AnimatedButton>
        }
        center={
          <WorkspaceChat
            messages={[
              {
                from: "You",
                message: "Hey! Excited to work on this topline — attached the AI reference.",
                isSelf: true,
              },
              {
                from: order.vocalistName,
                message: "Got it. I'll match the phrasing in the pre-chorus and send a first take in 48h.",
              },
            ]}
            inputPlaceholder="Message vocalist (mock)"
          />
        }
        right={
          <>
            <WorkspacePanel title="AI vocal preview" className="border-cyan-400/20 bg-cyan-500/5">
              <MockAudioPlayer
                title={order.reference || order.trackName}
                subtitle="Your AI vocal reference (mock)"
              />
            </WorkspacePanel>

            <WorkspacePanel title="Uploaded files">
              <ul className="space-y-2 text-sm text-zinc-300">
                <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                  ai-reference-demo.mp3
                </li>
                <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                  {order.hasPreview ? "vocal-preview-v1.wav (received)" : "vocal-preview-v1.wav (pending)"}
                </li>
                <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                  {order.hasStems ? "final-stems.zip (delivered)" : "final-stems.zip (pending)"}
                </li>
              </ul>
              <div className="mt-3">
                <FileUploadPlaceholder label="Upload preview" />
              </div>
            </WorkspacePanel>

            <WorkspacePanel title="Actions">
              <p className="mb-3 text-xs text-zinc-500">
                Status: <span className="text-zinc-300">{orderStatusLabel[order.status]}</span>
                {order.status === "preview_approved" && (
                  <span className="mt-1 block text-amber-200/90">
                    Waiting for vocalist to deliver stems.
                  </span>
                )}
                {order.status === "preview_pending" && (
                  <span className="mt-1 block text-amber-200/90">
                    Approve preview when ready, or request a revision.
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-2">
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
                <FileUploadPlaceholder label="Upload stems" />
                <AnimatedButton
                  type="button"
                  variant="primary"
                  disabled={!canComplete}
                  onClick={() => {
                    if (!canComplete) {
                      alert(
                        order.status === "preview_approved"
                          ? "Сначала Magdolina должна нажать Deliver stems."
                          : "Завершение доступно после сдачи stems (статус Delivery ready)."
                      );
                      return;
                    }
                    setShowReview(true);
                  }}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40"
                >
                  Mark completed & review
                </AnimatedButton>
              </div>
              {isCompleted && (
                <p className="mt-3 text-xs font-medium text-emerald-300">Project completed</p>
              )}
            </WorkspacePanel>
          </>
        }
      />

      {showReview &&
        typeof document !== "undefined" &&
        createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
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
            {reviewError && (
              <p className="mt-2 text-sm text-rose-300">{reviewError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <AnimatedButton
                type="button"
                variant="primary"
                disabled={submittingReview}
                onClick={onComplete}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                {submittingReview ? "Saving…" : "Submit review"}
              </AnimatedButton>
              <AnimatedButton
                type="button"
                variant="secondary"
                disabled={submittingReview}
                onClick={() => setShowReview(false)}
                className="rounded-lg px-4 py-2 text-sm"
              >
                Cancel
              </AnimatedButton>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );

  if (isAdminView) {
    return <AdminWorkspaceShell>{workspaceBody}</AdminWorkspaceShell>;
  }

  return (
    <InternalPageShell activeItem="projects" contentVariant="workspace">
      {workspaceBody}
    </InternalPageShell>
  );
}
