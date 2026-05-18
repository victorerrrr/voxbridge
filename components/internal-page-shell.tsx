"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import InternalShell from "@/components/internal-shell";
import { useClientAuth } from "@/lib/hooks/use-client-auth";

type InternalPageShellProps = {
  activeItem: string;
  children: ReactNode;
  contentVariant?: "default" | "workspace";
};

export function InternalPageShell({
  activeItem,
  children,
  contentVariant = "default",
}: InternalPageShellProps) {
  const router = useRouter();
  const { user, role, isAdmin, inAdminCenter, isReady, isAuthenticated, refresh } =
    useClientAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/signup");
      return;
    }
    if (inAdminCenter) {
      router.replace("/admin");
    }
  }, [isReady, isAuthenticated, inAdminCenter, router]);

  if (!isReady || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading...
      </main>
    );
  }

  return (
    <InternalShell
      role={role}
      isAdmin={isAdmin}
      onAdminRoleChange={refresh}
      activeItem={activeItem}
      contentVariant={contentVariant}
    >
      {children}
    </InternalShell>
  );
}
