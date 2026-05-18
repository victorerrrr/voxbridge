"use client";

import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/hooks/use-admin-guard";
import { useClientAuth } from "@/lib/hooks/use-client-auth";

type AdminPageShellProps = {
  activeItem: string;
  children: ReactNode;
};

export function AdminPageShell({ activeItem, children }: AdminPageShellProps) {
  const { allowed, isReady } = useAdminGuard();
  const { refresh } = useClientAuth();

  if (!isReady || !allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading admin...
      </main>
    );
  }

  return (
    <AdminShell activeItem={activeItem} onPreviewChange={refresh}>
      {children}
    </AdminShell>
  );
}
