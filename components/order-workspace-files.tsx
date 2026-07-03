"use client";

import { OrderFileUpload } from "@/components/order-file-upload";
import {
  latestFileOfKind,
  OrderFilesPanel,
} from "@/components/order-files-panel";
import { WorkspaceAudioPlayer } from "@/components/workspace-audio-player";
import { WorkspacePanel } from "@/components/order-workspace-layout";
import { useOrderFiles } from "@/lib/hooks/use-order-files";
import type { ProducerOrder } from "@/lib/orders";
import type { OrderFileKind } from "@/lib/order-files";

type OrderWorkspaceFilesProps = {
  order: ProducerOrder;
  role: "producer" | "vocalist";
};

export function OrderWorkspaceFiles({ order, role }: OrderWorkspaceFilesProps) {
  const { files, loading, refetch } = useOrderFiles(order.id);

  const reference = latestFileOfKind(files, "reference");
  const preview = latestFileOfKind(files, "preview") ?? latestFileOfKind(files, "revision");
  const stems = latestFileOfKind(files, "stems");

  const playbackUrl =
    role === "producer"
      ? reference?.playbackUrl
      : reference?.playbackUrl ?? preview?.playbackUrl;

  const playbackTitle =
    role === "producer"
      ? order.reference || order.trackName
      : order.reference || `${order.projectName || order.trackName} reference`;

  const canUploadReference = role === "producer" && order.status !== "completed";
  const canUploadPreview =
    role === "vocalist" &&
    (order.status === "in_progress" || order.status === "revision_requested");
  const canUploadRevision = role === "vocalist" && order.status === "revision_requested";
  const canUploadStems = role === "vocalist" && order.status === "preview_approved";

  return (
    <>
      <WorkspacePanel
        title={role === "producer" ? "AI vocal reference" : "AI vocal reference"}
        className="border-cyan-400/20 bg-cyan-500/5"
      >
        <WorkspaceAudioPlayer
          title={playbackTitle}
          subtitle={
            reference
              ? reference.fileName
              : role === "producer"
                ? "Upload your AI vocal reference"
                : "Waiting for producer reference"
          }
          url={playbackUrl}
          emptyHint={
            role === "producer"
              ? "Upload a reference file below."
              : "Producer has not uploaded a reference yet."
          }
        />
        {canUploadReference ? (
          <div className="mt-3">
            <OrderFileUpload
              orderId={order.id}
              kind="reference"
              label="Upload AI reference"
              onUploaded={refetch}
            />
          </div>
        ) : null}
      </WorkspacePanel>

      <WorkspacePanel title="Project files">
        <OrderFilesPanel
          files={files}
          loading={loading}
          highlightKind={highlightForStatus(order)}
        />

        {role === "vocalist" ? (
          <div className="mt-3 flex flex-col gap-2">
            {canUploadPreview && !canUploadRevision ? (
              <OrderFileUpload
                orderId={order.id}
                kind="preview"
                label="Upload preview"
                onUploaded={refetch}
              />
            ) : null}
            {canUploadRevision ? (
              <OrderFileUpload
                orderId={order.id}
                kind="revision"
                label="Upload revision"
                onUploaded={refetch}
              />
            ) : null}
            {canUploadStems ? (
              <OrderFileUpload
                orderId={order.id}
                kind="stems"
                label="Upload stems"
                onUploaded={refetch}
              />
            ) : null}
          </div>
        ) : null}

        {role === "producer" && preview ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Latest preview
            </p>
            <WorkspaceAudioPlayer
              title={preview.fileName}
              subtitle="From vocalist"
              url={preview.playbackUrl}
            />
          </div>
        ) : null}

        {role === "producer" && stems ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Final delivery
            </p>
            <p className="text-sm text-zinc-300">{stems.fileName}</p>
            <p className="mt-1 text-xs text-zinc-500">Open from the file list above.</p>
          </div>
        ) : null}
      </WorkspacePanel>
    </>
  );
}

function highlightForStatus(order: ProducerOrder): OrderFileKind | undefined {
  if (order.status === "preview_pending" || order.status === "revision_requested") {
    return "preview";
  }
  if (order.status === "preview_approved" || order.status === "delivery_ready") {
    return "stems";
  }
  return "reference";
}
