"use client";

export type UserRole = "producer" | "vocalist";

export type AuthUser = {
  email: string;
  username: string;
  role: UserRole;
  isAuthenticated: boolean;
  password?: string;
  avatar?: string;
};

type StoredAccount = Omit<AuthUser, "isAuthenticated">;

type AuthStorageState = {
  account: StoredAccount | null;
  session: {
    isAuthenticated: boolean;
  };
};

const STORAGE_KEY = "voxbridge_auth_state";
const LEGACY_STORAGE_KEY = "voxbridge_user";

const isRole = (value: unknown): value is UserRole => {
  return value === "producer" || value === "vocalist";
};

const isStoredAccount = (value: unknown): value is StoredAccount => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredAccount>;
  return Boolean(candidate.email) && Boolean(candidate.username) && isRole(candidate.role);
};

const normalizeAccount = (account: StoredAccount): StoredAccount => ({
  email: account.email.trim(),
  username: account.username.trim(),
  role: account.role,
  password: account.password,
  avatar: account.avatar,
});

const toAuthUser = (account: StoredAccount, isAuthenticated: boolean): AuthUser => ({
  ...account,
  isAuthenticated,
});

const defaultState = (): AuthStorageState => ({
  account: null,
  session: {
    isAuthenticated: false,
  },
});

const parseLegacyUser = (): AuthUser | null => {
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.email || !parsed.username || !isRole(parsed.role)) return null;
    return {
      email: parsed.email,
      username: parsed.username,
      role: parsed.role,
      isAuthenticated: parsed.isAuthenticated === true,
      password: parsed.password,
      avatar: parsed.avatar,
    };
  } catch {
    return null;
  }
};

const readAuthState = (): AuthStorageState => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const legacy = parseLegacyUser();
    if (!legacy) return defaultState();
    const migratedState: AuthStorageState = {
      account: normalizeAccount({
        email: legacy.email,
        username: legacy.username,
        role: legacy.role,
        password: legacy.password,
        avatar: legacy.avatar,
      }),
      session: {
        isAuthenticated: legacy.isAuthenticated === true,
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedState));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return migratedState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthStorageState>;
    const account = isStoredAccount(parsed.account) ? normalizeAccount(parsed.account) : null;
    return {
      account,
      session: {
        isAuthenticated: parsed.session?.isAuthenticated === true,
      },
    };
  } catch {
    return defaultState();
  }
};

const writeAuthState = (state: AuthStorageState): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const getStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  const state = readAuthState();
  if (!state.account) return null;
  return toAuthUser(state.account, state.session.isAuthenticated);
};

export const saveStoredUser = (user: AuthUser): void => {
  if (typeof window === "undefined") return;
  const nextState: AuthStorageState = {
    account: normalizeAccount({
      email: user.email,
      username: user.username,
      role: user.role,
      password: user.password,
      avatar: user.avatar,
    }),
    session: {
      isAuthenticated: user.isAuthenticated === true,
    },
  };
  writeAuthState(nextState);
};

export const clearStoredUser = (): void => {
  if (typeof window === "undefined") return;
  const state = readAuthState();
  if (!state.account) return;
  writeAuthState({
    ...state,
    session: {
      isAuthenticated: false,
    },
  });
};

export const updateStoredUser = (patch: Partial<AuthUser>): AuthUser | null => {
  const current = getStoredUser();
  if (!current) return null;

  const updated = { ...current, ...patch };
  saveStoredUser(updated);
  return updated;
};

export const registerStoredUser = (user: Omit<AuthUser, "isAuthenticated">): AuthUser => {
  const nextUser: AuthUser = {
    ...normalizeAccount(user),
    isAuthenticated: true,
  };
  saveStoredUser(nextUser);
  return nextUser;
};

export const loginStoredUser = (
  identifier: string,
  password: string
): { user: AuthUser | null; error: "account_not_found" | "invalid_credentials" | null } => {
  if (typeof window === "undefined") return { user: null, error: "account_not_found" };

  const state = readAuthState();
  if (!state.account) return { user: null, error: "account_not_found" };

  const normalizedIdentifier = identifier.trim().toLowerCase();
  const normalizedEmail = state.account.email.toLowerCase();
  const normalizedUsername = state.account.username.toLowerCase();
  const matchesIdentifier = normalizedIdentifier === normalizedEmail || normalizedIdentifier === normalizedUsername;
  const matchesPassword = Boolean(state.account.password) && state.account.password === password;

  if (!matchesIdentifier || !matchesPassword) {
    return { user: null, error: "invalid_credentials" };
  }

  const authenticatedUser = toAuthUser(state.account, true);
  saveStoredUser(authenticatedUser);
  return { user: authenticatedUser, error: null };
};
