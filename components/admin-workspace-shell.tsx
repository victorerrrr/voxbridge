"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { InternalBackground } from "@/components/internal-background";

export function AdminWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <InternalBackground />
      <header className="fixed left-0 right-0 top-0 z-[70] flex items-center justify-between gap-3 border-b border-amber-500/15 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl md:px-6">
        <Link
          href="/admin/workspaces"
          className="text-sm text-amber-300 hover:text-amber-200"
        >
          ← Back to workspaces
        </Link>
        <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-100">
          Admin view (read-only actions)
        </span>
      </header>
      <section className="relative z-10 min-h-screen p-4 pt-16 md:p-6 md:pt-16">
        {children}
      </section>
    </main>
  );
}
