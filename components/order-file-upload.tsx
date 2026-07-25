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
  prominent?: boolean;
  onUploaded?: () => void | Promise<void>;
};

export function OrderFileUpload({
  orderId,
  kind,
  label,
  disabled,
  prominent,
  onUploaded,
}: OrderFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (file: File | undefined) => {
    if (!file || disabled || uploading) return;
    setError(null);
    setDone(false);
    setProgress(0);
    setUploading(true);
    try {
      await uploadOrderFile(orderId, kind, file, (percent) => setProgress(percent));
      setDone(true);
      await onUploaded?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      setProgress(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label
        className={`flex flex-col rounded-lg border px-3 py-3 text-sm transition ${
          disabled || uploading
            ? "cursor-not-allowed border-white/10 bg-zinc-900/30 text-zinc-500"
            : prominent
              ? "cursor-pointer border-cyan-400/50 bg-cyan-500/15 font-medium text-cyan-100 hover:border-cyan-300/70 hover:bg-cyan-500/20"
              : "cursor-pointer border-dashed border-white/15 bg-zinc-900/50 text-zinc-400 hover:border-purple-400/40"
        }`}
      >
        <span>
          {uploading && progress != null
            ? `Uploading… ${progress}%`
            : done
              ? "Upload complete"
              : label}
        </span>
        <span className="mt-0.5 text-xs text-zinc-500">
          {done
            ? kind === "stems"
              ? "Deliver stems is ready in Actions →"
              : "Submit when ready in Actions →"
            : kind === "stems"
              ? "ZIP or audio"
              : "MP3, WAV, FLAC…"}
        </span>
        {uploading && progress != null ? (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-400 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
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
      {done && !error ? (
        <p className="mt-1 text-xs text-emerald-300">File saved — use Deliver stems below.</p>
      ) : null}
    </div>
  );
}
