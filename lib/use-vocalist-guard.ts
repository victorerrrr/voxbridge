"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, type AuthUser } from "@/lib/auth";
import { getVocalistProfileByEmail } from "@/lib/vocalist-profile";

type GuardOptions = {
  requireProfile?: boolean;
};

export function useVocalistGuard(options: GuardOptions = {}): AuthUser | null {
  const router = useRouter();
  const user = getStoredUser();

  useEffect(() => {
    if (!user || user.role !== "vocalist") {
      router.replace("/signup?role=vocalist");
      return;
    }
    if (options.requireProfile) {
      const profile = getVocalistProfileByEmail(user.email);
      if (!profile?.username) {
        router.replace("/vocalist/onboarding");
      }
    }
  }, [router, user?.email, user?.role, options.requireProfile]);

  if (!user || user.role !== "vocalist") return null;
  return user;
}
