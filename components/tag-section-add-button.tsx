"use client";

import { useEffect, useId, useRef, useState } from "react";

type TagSectionAddPopoverProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (tag: string) => void;
};

function TagSectionAddPopover({ open, onClose, onAdd }: TagSectionAddPopoverProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (open) {
      setValue("");
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="fixed inset-0 z-40 cursor-default bg-black/20"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-3rem,17rem)] rounded-xl border border-white/10 bg-zinc-950/95 p-3 shadow-[0_0_28px_rgba(168,85,247,0.18)] backdrop-blur-md"
      >
        <label id={labelId} className="mb-2 block text-xs font-medium text-zinc-400">
          Add new tag
        </label>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. Lo-fi"
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-lg border border-purple-400/40 bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-100 transition hover:bg-purple-500/30 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)]"
          >
            Add
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

export function TagSectionAddButton({ onAdd }: { onAdd: (tag: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add custom tag"
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-sm leading-none text-zinc-400 transition hover:border-purple-400/50 hover:bg-purple-500/10 hover:text-purple-200 hover:shadow-[0_0_16px_rgba(168,85,247,0.35)]"
      >
        +
      </button>
      <TagSectionAddPopover
        open={open}
        onClose={() => setOpen(false)}
        onAdd={onAdd}
      />
    </div>
  );
}
