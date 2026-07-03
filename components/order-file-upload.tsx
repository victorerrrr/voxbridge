"use client";

import { useRef, useState } from "react";
import {
  acceptForOrderFileKind,
  uploadOrderFile,
  type OrderFileKind,
} from "@/lib/order-files";

type OrderFileUploadProps = {
  orderId: string;
  kind: OrderFileKind;
  label: string;
  disabled?: boolean;
  onUploaded?: () => void;
};

export function OrderFileUpload({
  orderId,
  kind,
  label,
  disabled,
  onUploaded,
}: OrderFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (file: File | undefined) => {
    if (!file || disabled || uploading) return;
    setError(null);
    setUploading(true);
    try {
      await uploadOrderFile(orderId, kind, file);
      onUploaded?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label
        className={`flex flex-col rounded-lg border border-dashed px-3 py-2.5 text-sm transition ${
          disabled || uploading
            ? "cursor-not-allowed border-white/10 bg-zinc-900/30 text-zinc-500"
            : "cursor-pointer border-white/15 bg-zinc-900/50 text-zinc-400 hover:border-purple-400/40"
        }`}
      >
        <span>{uploading ? "Uploading…" : label}</span>
        <span className="mt-0.5 text-xs text-zinc-500">
          {kind === "stems" ? "ZIP or audio" : "MP3, WAV, FLAC…"}
        </span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={acceptForOrderFileKind(kind)}
          disabled={disabled || uploading}
          onChange={(e) => void onFileChange(e.target.files?.[0])}
        />
      </label>
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
