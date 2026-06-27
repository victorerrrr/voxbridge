"use client";

import type { ExternalLinks } from "@/lib/external-links";
import { supabase } from "@/lib/supabase-client";

export type UserRole = "producer" | "vocalist";

/** Stored on account; admin is only for the built-in admin login. */
export type StoredAccountRole = UserRole | "admin";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: StoredAccountRole;
  isAuthenticated: boolean;
  avatar?: string;
  externalLinks?: ExternalLinks;
};

const ADMIN_ROLE_OVERRIDE_KEY = "voxbridge_admin_role_override";

// NOTE: there is no more hardcoded ADMIN_EMAIL/ADMIN_PASSWORD constant.
// Admin status now comes from the `role` column on the `users` row in
// Supabase (set manually for whichever account should be an admin), not
// from a special-cased login/password pair. This is safer (no password
// embedded in the codebase) but means: to make someone an admin, update
// their row's `role` to 'admin' directly in the Supabase Table Editor or
// via SQL — there is no signup flow that creates an admin account.

type DbUserRow = {
  id: string;
  email: string;
  username: string;
  role: StoredAccountRole;
  avatar_url: string | null;
  external_link_spotify: string | null;
  external_link_soundcloud: string | null;
  external_link_youtube: string | null;
  external_link_instagram: string | null;
  external_link_website: string | null;
};

function rowToAuthUser(row: DbUserRow, isAuthenticated: boolean): AuthUser {
  const externalLinks: ExternalLinks = {};
  if (row.external_link_spotify) externalLinks.spotify = row.external_link_spotify;
  if (row.external_link_soundcloud) externalLinks.soundcloud = row.external_link_soundcloud;
  if (row.external_link_youtube) externalLinks.youtube = row.external_link_youtube;
  if (row.external_link_instagram) externalLinks.instagram = row.external_link_instagram;
  if (row.external_link_website) externalLinks.website = row.external_link_website;

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    isAuthenticated,
    avatar: row.avatar_url ?? undefined,
    externalLinks,
  };
}

/**
 * Current signed-in user, or null if not signed in.
 * Reads the active Supabase session, then fetches the matching profile row
 * from our `users` table (Supabase Auth only knows email/password — role,
 * username, avatar, externalLinks all live in our own table).
 */
export const getStoredUser = async (): Promise<AuthUser | null> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data: row, error } = await supabase
    .from("users")
    .select(
      "id, email, username, role, avatar_url, external_link_spotify, external_link_soundcloud, external_link_youtube, external_link_instagram, external_link_website"
    )
    .eq("id", session.user.id)
    .single();

  if (error || !row) return null;
  return rowToAuthUser(row as DbUserRow, true);
};/**
* Persist profile field changes (username, avatar, externalLinks) for the
* CURRENTLY signed-in user. Does not touch email/password — those go
* through Supabase Auth's own update methods if ever needed.
*/
export const saveStoredUser = async (user: AuthUser): Promise<void> => {
 await supabase
   .from("users")
   .update({
     username: user.username,
     avatar_url: user.avatar ?? null,
     external_link_spotify: user.externalLinks?.spotify ?? null,
     external_link_soundcloud: user.externalLinks?.soundcloud ?? null,
     external_link_youtube: user.externalLinks?.youtube ?? null,
     external_link_instagram: user.externalLinks?.instagram ?? null,
     external_link_website: user.externalLinks?.website ?? null,
   })
   .eq("id", user.id);
};

export const updateStoredUser = async (
 patch: Partial<AuthUser>
): Promise<AuthUser | null> => {
 const current = await getStoredUser();
 if (!current) return null;

 const updated: AuthUser = { ...current, ...patch };
 await saveStoredUser(updated);
 return updated;
};

export const clearStoredUser = async (): Promise<void> => {
 await supabase.auth.signOut();
};

/**
* Sign up a new user: creates the Supabase Auth account (email/password),
* then inserts the matching profile row into our `users` table with the
* SAME id (auth.users.id), since users.id references auth.users(id).
*
* NOTE: if "Confirm email" is enabled in Supabase Auth settings (it is by
* default), the user will need to click a confirmation link before they
* can sign in — signUp succeeding here does NOT mean they're immediately
* logged in.
*/
export const registerStoredUser = async (
 user: Omit<AuthUser, "id" | "isAuthenticated"> & { password: string }
): Promise<{ user: AuthUser | null; error: string | null }> => {
 const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
   email: user.email.trim(),
   password: user.password,
 });

 if (signUpError) {
   return { user: null, error: signUpError.message };
 }
 if (!signUpData.user) {
   return { user: null, error: "Sign up did not return a user." };
 }

 const { error: insertError } = await supabase.from("users").insert({
   id: signUpData.user.id,
   email: user.email.trim(),
   username: user.username.trim(),
   role: user.role,
 });

 if (insertError) {
   return { user: null, error: insertError.message };
 }

 return {
   user: {
     id: signUpData.user.id,
     email: user.email.trim(),
     username: user.username.trim(),
     role: user.role,
     isAuthenticated: Boolean(signUpData.session),
   },
   error: null,
 };
};/**
* Sign in by email + password. Username-based login is intentionally not
* supported (matches standard Supabase Auth behavior and modern practice —
* username is a display field, not a login credential).
*/
export const loginStoredUser = async (
 email: string,
 password: string
): Promise<{ user: AuthUser | null; error: "invalid_credentials" | "unknown" | null }> => {
 const { data, error } = await supabase.auth.signInWithPassword({
   email: email.trim(),
   password,
 });

 if (error || !data.user) {
   return { user: null, error: "invalid_credentials" };
 }

 const { data: row, error: rowError } = await supabase
   .from("users")
   .select(
     "id, email, username, role, avatar_url, external_link_spotify, external_link_soundcloud, external_link_youtube, external_link_instagram, external_link_website"
   )
   .eq("id", data.user.id)
   .single();

 if (rowError || !row) {
   return { user: null, error: "unknown" };
 }

 return { user: rowToAuthUser(row as DbUserRow, true), error: null };
};

export const isAdminAccount = (user: AuthUser | null | undefined): boolean => {
 return user?.role === "admin";
};

export const getAdminRoleOverride = (): UserRole | null => {
 if (typeof window === "undefined") return null;
 const stored = window.localStorage.getItem(ADMIN_ROLE_OVERRIDE_KEY);
 return stored === "producer" || stored === "vocalist" ? stored : null;
};

export const setAdminRoleOverride = (role: UserRole): void => {
 if (typeof window === "undefined") return;
 window.localStorage.setItem(ADMIN_ROLE_OVERRIDE_KEY, role);
};

export const clearAdminRoleOverride = (): void => {
 if (typeof window === "undefined") return;
 window.localStorage.removeItem(ADMIN_ROLE_OVERRIDE_KEY);
};

/** Admin logged in without producer/vocalist preview override. */
export const isInAdminCenter = (user: AuthUser | null | undefined): boolean => {
 if (!isAdminAccount(user)) return false;
 return getAdminRoleOverride() === null;
};

export const getEffectiveRole = (user: AuthUser | null | undefined): UserRole => {
 if (!user) return "producer";
 if (isAdminAccount(user)) {
   const override = getAdminRoleOverride();
   if (override) return override;
   return "producer";
 }
 if (user.role === "producer" || user.role === "vocalist") return user.role;
 return "producer";
};export const updateEmail = async (newEmail: string): Promise<{ error: string | null }> => {
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
  return { error: error?.message ?? null };
};

export const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message ?? null };
};