"use client";

import { AnimatedButton } from "@/components/animated-button";
import {
  FileUploadPlaceholder,
  OrderWorkspaceLayout,
  WorkspaceChat,
  WorkspacePanel,
} from "@/components/order-workspace-layout";
import { MockAudioPlayer } from "@/components/mock-audio-player";
import { useProducerOrder } from "@/lib/hooks/use-producer-orders";
import { submitFinalDelivery, submitPreview, submitRevision } from "@/lib/orders";

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
    <OrderWorkspaceLayout
      backHref="/vocalist/orders"
      backLabel="Orders"
      order={order}
      counterpartyLabel="Producer"
      counterpartyName={order.producerName || "Producer"}
      leftExtra={
        order.budget != null ? (
          <p className="text-xs text-zinc-500">
            Budget <span className="text-zinc-300">${order.budget}</span>
          </p>
        ) : null
      }
      center={
        <WorkspaceChat
          messages={[
            {
              from: order.producerName || "Producer",
              message: "Looking forward to your take — match the reference energy in the hook.",
            },
            { from: "You", message: "On it. First preview coming soon.", isSelf: true },
          ]}
          inputPlaceholder="Message producer (mock)"
        />
      }
      right={
        <>
          <WorkspacePanel title="AI vocal reference" className="border-cyan-400/20 bg-cyan-500/5">
            <MockAudioPlayer
              title={order.reference || `${order.projectName || order.trackName} reference`}
              subtitle="Producer AI vocal reference (mock)"
            />
          </WorkspacePanel>

          <WorkspacePanel title="Files">
            <ul className="space-y-2 text-sm text-zinc-300">
              <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                {order.hasPreview ? "vocal-preview-v1.wav" : "vocal-preview-v1.wav (pending)"}
              </li>
              <li className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
                {order.hasStems ? "final-stems.zip" : "final-stems.zip (pending)"}
              </li>
            </ul>
          </WorkspacePanel>

          <WorkspacePanel title="Actions">
            {waitingApproval && (
              <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Preview submitted — waiting for approval.
              </p>
            )}
            <div className="flex flex-col gap-2">
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
          </WorkspacePanel>
        </>
      }
    />
  );
}
