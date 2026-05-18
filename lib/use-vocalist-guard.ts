"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, type AuthUser } from "@/lib/auth";
import { getVocalistProfileByEmail } from "@/lib/vocalist-profile";

type GuardOptions = {
  requireProfile?: boolean;
};

export function useVocalistGuard(options: GuardOptions = {}): AuthUser | null {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || stored.role !== "vocalist") {
      router.replace("/signup?role=vocalist");
      return;
    }
    if (options.requireProfile) {
      const profile = getVocalistProfileByEmail(stored.email);
      if (!profile?.username) {
        router.replace("/vocalist/onboarding");
        return;
      }
    }
    setUser(stored);
  }, [router, options.requireProfile]);

  return user;
}
