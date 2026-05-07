"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import InternalShell from "@/components/internal-shell";
import { getStoredUser, type AuthUser } from "@/lib/auth";

type InternalPageShellProps = {
  activeItem: string;
  children: ReactNode;
};

export function InternalPageShell({ activeItem, children }: InternalPageShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authUser = getStoredUser();
    if (!authUser || !authUser.isAuthenticated) {
      router.replace("/signup");
      return;
    }
    setUser(authUser);
    setIsLoading(false);
  }, [router]);

  if (isLoading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">Loading...</main>;
  }

  return (
    <InternalShell role={user.role} activeItem={activeItem}>
      {children}
    </InternalShell>
  );
}
