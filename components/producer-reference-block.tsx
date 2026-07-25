"use client";

import { useState } from "react";
import { OrderFileUpload } from "@/components/order-file-upload";
import { ReferencePlayer } from "@/components/reference-player";
import { latestFileOfKind } from "@/components/order-files-panel";
import { deleteOrderFile } from "@/lib/order-files";
import { useOrderFiles } from "@/lib/hooks/use-order-files";

type ProducerReferenceBlockProps = {
  orderId: string;
  trackTitle: string;
  disabled?: boolean;
};

export function ProducerReferenceBlock({
  orderId,
  trackTitle,
  disabled,
}: ProducerReferenceBlockProps) {
  const { files, refetch } = useOrderFiles(orderId);
  const references = files.filter((f) => f.kind === "reference");
  const reference = latestFileOfKind(files, "reference");
  const [clearing, setClearing] = useState(false);

  const clearAllReferences = async () => {
    setClearing(true);
    try {
      for (const f of references) {
        await deleteOrderFile(f);
      }
      await refetch();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-cyan-400">
        AI reference
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Шаг 1: загрузи файл (30 сек / 1–5 MB — нормально). Шаг 2: нажми ▶.
      </p>

      <div className="mt-3">
        <OrderFileUpload
          orderId={orderId}
          kind="reference"
          label={reference ? "Replace reference" : "Upload AI reference"}
          prominent
          disabled={disabled || clearing}
          onUploaded={refetch}
        />
      </div>

      {reference ? (
        <div className="mt-3">
          <ReferencePlayer file={reference} onDeleted={refetch} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          Файла ещё нет — загрузи {trackTitle ? `для «${trackTitle}»` : "AI vocal"} выше.
        </p>
      )}

      {references.length > 1 ? (
        <div className="mt-2">
          <p className="text-xs text-amber-200/80">
            {references.length} битых/старых записей — лучше очистить.
          </p>
          <button
            type="button"
            disabled={clearing}
            onClick={() => void clearAllReferences()}
            className="mt-1 text-xs text-amber-100 underline hover:text-white disabled:opacity-50"
          >
            {clearing ? "Очищаю…" : "Удалить все reference-записи"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
