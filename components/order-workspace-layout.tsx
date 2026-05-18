"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { orderStatusLabel, type ProducerOrder } from "@/lib/orders";

type OrderWorkspaceLayoutProps = {
  backHref: string;
  backLabel: string;
  order: ProducerOrder;
  counterpartyLabel: string;
  counterpartyName: string;
  leftExtra?: ReactNode;
  center: ReactNode;
  right: ReactNode;
};

const MIN_LEFT = 160;
const MAX_LEFT = 320;
const MIN_RIGHT = 180;
const MAX_RIGHT = 360;
const MIN_CHAT = 120;

function useDragResize(
  onDelta: (delta: number) => void,
  axis: "x" | "y"
): { onPointerDown: (event: PointerEvent<HTMLDivElement>) => void } {
  const startRef = useRef({ pos: 0, value: 0 });

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startPos = axis === "x" ? event.clientX : event.clientY;
      const handleMove = (moveEvent: globalThis.PointerEvent) => {
        const current = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        onDelta(current - startRef.current.pos);
        startRef.current.pos = current;
      };
      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
      startRef.current.pos = startPos;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [axis, onDelta]
  );

  return { onPointerDown };
}

export function OrderWorkspaceLayout({
  backHref,
  backLabel,
  order,
  counterpartyLabel,
  counterpartyName,
  leftExtra,
  center,
  right,
}: OrderWorkspaceLayoutProps) {
  const title = order.projectName || order.trackName;
  const [leftWidth, setLeftWidth] = useState(224);
  const [rightWidth, setRightWidth] = useState(256);

  const leftDrag = useDragResize((delta) => {
    setLeftWidth((w) => Math.min(MAX_LEFT, Math.max(MIN_LEFT, w + delta)));
  }, "x");

  const rightDrag = useDragResize((delta) => {
    setRightWidth((w) => Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, w - delta)));
  }, "x");

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[32rem] flex-col gap-3 md:h-[calc(100vh-7rem)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <Link href={backHref} className="text-sm text-zinc-400 transition hover:text-zinc-200">
          ← {backLabel}
        </Link>
        <WorkspaceStatusBadge status={order.status} />
      </div>

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside
          style={{ width: leftWidth }}
          className="flex shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/50 p-4"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Project</p>
            <h1 className="mt-1 text-lg font-semibold leading-tight text-white">{title}</h1>
          </div>
          <dl className="space-y-2 text-xs text-zinc-400">
            <div>
              <dt className="text-zinc-500">{counterpartyLabel}</dt>
              <dd className="font-medium text-zinc-200">{counterpartyName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd className="text-zinc-300">{orderStatusLabel[order.status]}</dd>
            </div>
          </dl>
          {leftExtra}
        </aside>

        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={leftDrag.onPointerDown}
          className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-purple-500/25"
        >
          <span className="absolute inset-y-4 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-white/10 group-hover:bg-purple-400/60" />
        </div>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950/60">
          {center}
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={rightDrag.onPointerDown}
          className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-cyan-500/25"
        >
          <span className="absolute inset-y-4 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-white/10 group-hover:bg-cyan-400/60" />
        </div>

        <aside
          style={{ width: rightWidth }}
          className="flex shrink-0 flex-col gap-3 overflow-y-auto"
        >
          {right}
        </aside>
      </div>
    </div>
  );
}

export function WorkspacePanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-xl border border-white/10 bg-zinc-950/60 p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <div className="mt-3">{children}</div>
    </article>
  );
}

export function WorkspaceChat({
  messages,
  inputPlaceholder = "Type a message…",
}: {
  messages: { from: string; message: string; isSelf?: boolean }[];
  inputPlaceholder?: string;
}) {
  const [messagesHeight, setMessagesHeight] = useState(280);

  const verticalDrag = useDragResize((delta) => {
    setMessagesHeight((h) => Math.max(MIN_CHAT, h + delta));
  }, "y");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div style={{ height: messagesHeight }} className="min-h-0 overflow-y-auto p-4">
        <div className="space-y-2">
          {messages.map((msg, i) => (
            <div
              key={`${msg.from}-${i}`}
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                msg.isSelf
                  ? "ml-auto border border-purple-400/25 bg-purple-500/15"
                  : "border border-white/10 bg-zinc-900/70"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{msg.from}</p>
              <p className="mt-0.5 text-sm text-zinc-200">{msg.message}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={verticalDrag.onPointerDown}
        className="group relative h-2 shrink-0 cursor-row-resize bg-transparent hover:bg-purple-500/20"
      >
        <span className="absolute left-1/2 top-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 group-hover:bg-purple-400/50" />
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex gap-2">
          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-200">
            <span className="sr-only">Attach file</span>
            <AttachIcon />
            <input type="file" className="hidden" accept="audio/*,.zip" onChange={() => undefined} />
          </label>
          <input
            disabled
            placeholder={inputPlaceholder}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300 placeholder:text-zinc-500"
          />
        </div>
      </div>
    </div>
  );
}

export function FileUploadPlaceholder({ label }: { label: string }) {
  return (
    <label className="flex cursor-pointer flex-col rounded-lg border border-dashed border-white/15 bg-zinc-900/50 px-3 py-2.5 text-sm text-zinc-400 transition hover:border-purple-400/40">
      <span>{label}</span>
      <span className="mt-0.5 text-xs text-zinc-500">Click to select (mock)</span>
      <input type="file" className="hidden" accept="audio/*,.zip" onChange={() => undefined} />
    </label>
  );
}

function WorkspaceStatusBadge({ status }: { status: ProducerOrder["status"] }) {
  const styles: Record<ProducerOrder["status"], string> = {
    in_progress: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    preview_pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    revision_requested: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    preview_approved: "border-purple-400/30 bg-purple-500/10 text-purple-200",
    delivery_ready: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${styles[status]}`}>
      {orderStatusLabel[status]}
    </span>
  );
}

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
