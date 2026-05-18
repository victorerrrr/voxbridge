"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClientAuth } from "@/lib/hooks/use-client-auth";

/** Protect /admin/* — authenticated admins only. */
export function useAdminGuard(): { isReady: boolean; allowed: boolean } {
  const router = useRouter();
  const { isReady, isAuthenticated, isAdmin } = useClientAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/home");
    }
  }, [isReady, isAuthenticated, isAdmin, router]);

  return {
    isReady,
    allowed: isReady && isAuthenticated && isAdmin,
  };
}
