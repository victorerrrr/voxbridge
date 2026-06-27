"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEffectiveRole,
  getStoredUser,
  isAdminAccount,
  isInAdminCenter,
  type AuthUser,
  type UserRole,
} from "@/lib/auth";

export type ClientAuthState = {
  user: AuthUser | null;
  role: UserRole;
  isAdmin: boolean;
  inAdminCenter: boolean;
  isAuthenticated: boolean;
  isReady: boolean;
};

const INITIAL: ClientAuthState = {
  user: null,
  role: "producer",
  isAdmin: false,
  inAdminCenter: false,
  isAuthenticated: false,
  isReady: false,
};

async function readAuthState(): Promise<ClientAuthState> {
  const user = await getStoredUser();
  if (!user?.isAuthenticated) {
    return { ...INITIAL, isReady: true };
  }
  return {
    user,
    role: getEffectiveRole(user),
    isAdmin: isAdminAccount(user),
    inAdminCenter: isInAdminCenter(user),
    isAuthenticated: true,
    isReady: true,
  };
}

export function useClientAuth(): ClientAuthState & { refresh: () => void } {
  const [state, setState] = useState<ClientAuthState>(INITIAL);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    readAuthState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  return { ...state, refresh };
}