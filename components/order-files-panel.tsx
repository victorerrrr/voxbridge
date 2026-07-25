"use client";

import { useState } from "react";
import { ReferencePlayer } from "@/components/reference-player";
import {
  getOrderFileDownloadUrl,
  orderFileKindLabel,
  type OrderFile,
  type OrderFileKind,
} from "@/lib/order-files";

type OrderFilesPanelProps = {
  files: OrderFile[];
  loading?: boolean;
  highlightKind?: OrderFileKind;
  /** Only show the latest file per kind (less clutter). */
  latestOnly?: boolean;
  emptyMessage?: string;
};

export function OrderFilesPanel({
  files,
  loading,
  highlightKind,
  latestOnly,
  emptyMessage,
}: OrderFilesPanelProps) {
  if (loading) {
    return <p className="text-sm text-zinc-500">Loading files…</p>;
  }

  if (files.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {emptyMessage ?? "No files uploaded yet."}
      </p>
    );
  }

  const grouped = (["reference", "preview", "revision", "stems"] as OrderFileKind[]).map(
    (kind) => {
      const items = files.filter((f) => f.kind === kind);
      return {
        kind,
        items: latestOnly && items.length > 0 ? [items[items.length - 1]] : items,
      };
    }
  );

  return (
    <ul className="space-y-3 text-sm text-zinc-300">
      {grouped.map(({ kind, items }) =>
        items.length === 0 ? null : (
          <li key={kind}>
            <p
              className={`mb-1.5 text-xs font-medium uppercase tracking-wide ${
                highlightKind === kind ? "text-cyan-300" : "text-zinc-500"
              }`}
            >
              {orderFileKindLabel[kind]}
            </p>
            <ul className="space-y-2">
              {items.map((file) => (
                <OrderFileRow key={file.id} file={file} />
              ))}
            </ul>
          </li>
        )
      )}
    </ul>
  );
}

function OrderFileRow({ file }: { file: OrderFile }) {
  const [loadingUrl, setLoadingUrl] = useState(false);

  const onOpen = async () => {
    setLoadingUrl(true);
    try {
      const url = file.playbackUrl ?? (await getOrderFileDownloadUrl(file.storagePath));
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setLoadingUrl(false);
    }
  };

  const sizeLabel =
    file.sizeBytes != null ? `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : null;

  if (file.kind !== "stems") {
    return (
      <li>
        <ReferencePlayer file={file} />
        {sizeLabel ? <p className="mt-1 text-xs text-zinc-500">{sizeLabel}</p> : null}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate">{file.fileName}</p>
        {sizeLabel ? <p className="text-xs text-zinc-500">{sizeLabel}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void onOpen()}
        disabled={loadingUrl}
        className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 transition hover:border-purple-400/40 hover:text-white disabled:opacity-50"
      >
        {loadingUrl ? "…" : "Open"}
      </button>
    </li>
  );
}

export function latestFileOfKind(
  files: OrderFile[],
  kind: OrderFileKind
): OrderFile | undefined {
  const matches = files.filter((f) => f.kind === kind);
  return matches[matches.length - 1];
}
