"use client";

import { OrderFileUpload } from "@/components/order-file-upload";
import {
  latestFileOfKind,
  OrderFilesPanel,
} from "@/components/order-files-panel";
import { ReferencePlayer } from "@/components/reference-player";
import { WorkspacePanel } from "@/components/order-workspace-layout";
import { useOrderFiles } from "@/lib/hooks/use-order-files";
import type { ProducerOrder } from "@/lib/orders";
import type { OrderFileKind } from "@/lib/order-files";

import type { OrderFile } from "@/lib/order-files";

type FilesBundle = {
  files: OrderFile[];
  loading: boolean;
  refetch: () => Promise<void>;
};

type OrderWorkspaceFilesProps = {
  order: ProducerOrder;
  role: "producer" | "vocalist";
  /** Share one files hook with parent (vocalist Actions panel). */
  filesBundle?: FilesBundle;
};

export function OrderWorkspaceFiles({ order, role, filesBundle }: OrderWorkspaceFilesProps) {
  const internal = useOrderFiles(filesBundle ? undefined : order.id);
  const { files, loading, refetch } = filesBundle ?? internal;

  const reference = latestFileOfKind(files, "reference");
  const preview = latestFileOfKind(files, "preview") ?? latestFileOfKind(files, "revision");
  const stems = latestFileOfKind(files, "stems");

  const canUploadPreview =
    role === "vocalist" &&
    (order.status === "in_progress" || order.status === "revision_requested");
  const canUploadRevision = role === "vocalist" && order.status === "revision_requested";
  const canUploadStems = role === "vocalist" && order.status === "preview_approved";

  return (
    <>
      {role === "vocalist" ? (
        <WorkspacePanel
          title="AI vocal reference"
          className="border-cyan-400/20 bg-cyan-500/5"
        >
          {reference ? (
            <ReferencePlayer file={reference} onDeleted={refetch} />
          ) : (
            <p className="text-sm text-zinc-500">Producer has not uploaded a reference yet.</p>
          )}
        </WorkspacePanel>
      ) : null}

      <WorkspacePanel title="Project files">
        <OrderFilesPanel
          files={
            role === "vocalist"
              ? files.filter((f) => f.kind !== "reference")
              : files
          }
          loading={loading}
          highlightKind={highlightForStatus(order)}
          latestOnly={role === "producer"}
          emptyMessage={
            role === "vocalist"
              ? order.status === "preview_approved" ||
                order.status === "delivery_ready" ||
                order.status === "completed"
                ? "Your preview was sent — upload final stems below."
                : "Your uploads (preview, stems) appear here. Producer reference is above."
              : undefined
          }
        />

        {role === "vocalist" ? (
          <div className="mt-3 flex flex-col gap-2">
            {canUploadPreview && !canUploadRevision ? (
              <OrderFileUpload
                orderId={order.id}
                kind="preview"
                label="Upload preview"
                onUploaded={async () => {
                  await refetch();
                }}
              />
            ) : null}
            {canUploadRevision ? (
              <OrderFileUpload
                orderId={order.id}
                kind="revision"
                label="Upload revision"
                onUploaded={async () => {
                  await refetch();
                }}
              />
            ) : null}
            {canUploadStems ? (
              <OrderFileUpload
                orderId={order.id}
                kind="stems"
                label="Upload stems"
                onUploaded={async () => {
                  await refetch();
                }}
              />
            ) : null}
          </div>
        ) : null}

        {role === "producer" && preview ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Latest preview
            </p>
            <ReferencePlayer file={preview} onDeleted={refetch} />
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
