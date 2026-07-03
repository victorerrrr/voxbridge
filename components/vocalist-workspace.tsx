"use client";

import { AnimatedButton } from "@/components/animated-button";
import { OrderWorkspaceFiles } from "@/components/order-workspace-files";
import {
  OrderWorkspaceLayout,
  WorkspaceChat,
  WorkspacePanel,
} from "@/components/order-workspace-layout";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { useProducerOrder } from "@/lib/hooks/use-producer-orders";
import { submitFinalDelivery, submitPreview, submitRevision } from "@/lib/orders";

type VocalistWorkspaceProps = {
  orderId: string;
};

export function VocalistWorkspace({ orderId }: VocalistWorkspaceProps) {
  const { user } = useClientAuth();
  const { order } = useProducerOrder(orderId);

  if (!order) return null;

  const producerDisplay = order.producerName || "Producer";
  const selfDisplay = user?.username || order.vocalistName || "Vocalist";

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
      counterpartyName={producerDisplay}
      viewerRole="vocalist"
      selfName={selfDisplay}
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
              from: producerDisplay,
              message: "Looking forward to your take — match the reference energy in the hook.",
            },
            { from: "You", message: "On it. First preview coming soon.", isSelf: true },
          ]}
          inputPlaceholder="Message producer (mock)"
        />
      }
      right={
        <>
          <OrderWorkspaceFiles order={order} role="vocalist" />

          <WorkspacePanel title="Actions">
            {waitingApproval && (
              <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Preview submitted — waiting for approval.
              </p>
            )}
            <div className="flex flex-col gap-2">
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
                <AnimatedButton
                  type="button"
                  variant="primary"
                  onClick={() => submitRevision(order.id)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium"
                >
                  Submit revision
                </AnimatedButton>
              )}
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
