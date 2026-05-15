"use client";

import { type ReactNode } from "react";
import { InternalPageShell } from "@/components/internal-page-shell";

type VocalistFlowShellProps = {
  activeItem: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function VocalistFlowShell({ activeItem, title, subtitle, children }: VocalistFlowShellProps) {
  return (
    <InternalPageShell activeItem={activeItem}>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Vocalist setup</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-2 text-zinc-400">{subtitle}</p>
        </header>
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-6">{children}</div>
      </div>
    </InternalPageShell>
  );
}
