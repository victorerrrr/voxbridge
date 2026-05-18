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
  /** Admin session without producer/vocalist preview override. */
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

function readAuthState(): ClientAuthState {
  const user = getStoredUser();
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

/** Auth from localStorage — stable on server and first client paint until after mount. */
export function useClientAuth(): ClientAuthState & { refresh: () => void } {
  const [state, setState] = useState<ClientAuthState>(INITIAL);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setState(readAuthState());
  }, [revision]);

  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  return { ...state, refresh };
}
