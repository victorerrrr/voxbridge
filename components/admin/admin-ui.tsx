"use client";

import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6 space-y-2">
      <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h1>
      {description && <p className="max-w-2xl text-sm text-zinc-400">{description}</p>}
    </header>
  );
}

export function AdminStatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

export function AdminStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    producer: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
    vocalist: "border-purple-400/35 bg-purple-500/10 text-purple-100",
    admin: "border-amber-400/35 bg-amber-500/10 text-amber-100",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
        styles[role] ?? "border-white/20 bg-white/5 text-zinc-300"
      }`}
    >
      {role}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "text-emerald-300",
    blocked: "text-rose-300",
    pending: "text-amber-300",
    open: "text-amber-300",
    resolved: "text-zinc-400",
    approved: "text-emerald-300",
    rejected: "text-rose-300",
  };
  return (
    <span className={`text-xs font-medium capitalize ${styles[status] ?? "text-zinc-400"}`}>
      {status}
    </span>
  );
}

export function AdminActionButton({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2 py-1 text-xs transition ${
        variant === "danger"
          ? "border-rose-400/40 text-rose-200 hover:bg-rose-500/15"
          : "border-white/15 text-zinc-300 hover:border-white/30 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
