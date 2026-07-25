"use client";

import { AnimatedButton } from "@/components/animated-button";
import { OrderWorkspaceFiles } from "@/components/order-workspace-files";
import {
  OrderWorkspaceLayout,
  WorkspaceChat,
  WorkspacePanel,
} from "@/components/order-workspace-layout";
import { latestFileOfKind } from "@/components/order-files-panel";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { useOrderFiles } from "@/lib/hooks/use-order-files";
import { useProducerOrder } from "@/lib/hooks/use-producer-orders";
import { submitFinalDelivery, submitPreview, submitRevision } from "@/lib/orders";

type VocalistWorkspaceProps = {
  orderId: string;
};

export function VocalistWorkspace({ orderId }: VocalistWorkspaceProps) {
  const { user } = useClientAuth();
  const { order } = useProducerOrder(orderId);
  const filesBundle = useOrderFiles(orderId);

  if (!order) return null;

  const { files } = filesBundle;

  const producerDisplay = order.producerName || "Producer";
  const selfDisplay = user?.username || order.vocalistName || "Vocalist";

  const canSubmitPreview = order.status === "in_progress" || order.status === "revision_requested";
  const canSubmitRevision = order.status === "revision_requested";
  const canSubmitFinal = order.status === "preview_approved";
  const waitingApproval = order.status === "preview_pending";

  const previewFile = latestFileOfKind(files, "preview");
  const revisionFile = latestFileOfKind(files, "revision");
  const stemsFile = latestFileOfKind(files, "stems");
  const hasPreviewToSubmit = canSubmitRevision ? !!revisionFile : !!previewFile;
  const hasStemsToDeliver = !!stemsFile;

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
          <OrderWorkspaceFiles order={order} role="vocalist" filesBundle={filesBundle} />

          <WorkspacePanel title="Actions">
            <p className="mb-3 text-xs text-zinc-500">
              Step:{" "}
              <span className="text-zinc-300">
                {order.status === "in_progress" && "Upload preview → Submit preview"}
                {order.status === "preview_pending" && "Waiting for producer approval"}
                {order.status === "revision_requested" && "Upload revision → Submit revision"}
                {order.status === "preview_approved" && "Upload stems → Deliver stems"}
                {order.status === "delivery_ready" && "Waiting for producer to complete"}
                {order.status === "completed" && "Done — see your review below"}
              </span>
            </p>
            {waitingApproval && (
              <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Preview submitted — waiting for approval.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {canSubmitPreview && !canSubmitRevision && !waitingApproval && (
                <>
                  {!hasPreviewToSubmit ? (
                    <p className="text-xs text-zinc-500">
                      Upload preview above, then submit for producer approval.
                    </p>
                  ) : null}
                  <AnimatedButton
                    type="button"
                    variant="primary"
                    disabled={!hasPreviewToSubmit}
                    onClick={() => void submitPreview(order.id)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40"
                  >
                    Submit preview
                  </AnimatedButton>
                </>
              )}
              {canSubmitRevision && (
                <>
                  {!hasPreviewToSubmit ? (
                    <p className="text-xs text-zinc-500">
                      Upload revision above, then submit again.
                    </p>
                  ) : null}
                  <AnimatedButton
                    type="button"
                    variant="primary"
                    disabled={!hasPreviewToSubmit}
                    onClick={() => void submitRevision(order.id)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40"
                  >
                    Submit revision
                  </AnimatedButton>
                </>
              )}
              {canSubmitFinal && (
                <>
                  <p className="text-xs text-emerald-200/90">
                    Preview approved — final delivery. No &quot;Submit&quot; here; use Deliver stems
                    after upload.
                  </p>
                  {!hasStemsToDeliver ? (
                    <p className="text-xs text-zinc-500">
                      Upload stems (ZIP or audio), then deliver.
                    </p>
                  ) : null}
                  <AnimatedButton
                    type="button"
                    variant="secondary"
                    disabled={!hasStemsToDeliver}
                    onClick={() => void submitFinalDelivery(order.id)}
                    className="rounded-lg px-4 py-2.5 text-sm disabled:opacity-40"
                  >
                    Deliver stems
                  </AnimatedButton>
                </>
              )}
              {order.status === "delivery_ready" && (
                <p className="text-xs text-emerald-300">
                  Stems delivered — waiting for producer to complete the project.
                </p>
              )}
              {order.status === "completed" && (
                <AnimatedButton
                  href={`/vocalists/${order.vocalistId}`}
                  variant="secondary"
                  className="rounded-lg px-4 py-2 text-xs"
                >
                  View review on My Profile
                </AnimatedButton>
              )}
            </div>
          </WorkspacePanel>
        </>
      }
    />
  );
}
