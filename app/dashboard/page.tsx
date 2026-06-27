"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthUser,
  clearStoredUser,
  getStoredUser,
  saveStoredUser,
  updateEmail,
  updatePassword,
  updateStoredUser,
} from "@/lib/auth";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { ExternalLinksEditor } from "@/components/external-links-section";
import type { ExternalLinks } from "@/lib/external-links";
import PasswordInput from "@/components/password-input";
import { AnimatedButton } from "@/components/animated-button";
import InternalShell from "@/components/internal-shell";
import { ProducerProjectsSection } from "@/components/producer-projects-section";

type TabKey = "overview" | "profile" | "settings" | "vocal-profile" | "samples" | "projects" | "saved-vocalists";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
          Loading dashboard...
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role: effectiveRole, isAdmin, inAdminCenter, isReady, isAuthenticated, refresh } =
    useClientAuth();
  const [userState, setUserState] = useState<AuthUser | null>(null);

  const selectedTab = (searchParams.get("tab") as TabKey | null) ?? "overview";

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/signup");
      return;
    }
    if (inAdminCenter) {
      router.replace("/admin");
      return;
    }
    if (user) setUserState(user);
  }, [isReady, isAuthenticated, inAdminCenter, router, user]);

  const activeUser = userState ?? user;

  const tabs = useMemo<TabKey[]>(() => {
    if (!activeUser) return ["overview", "profile", "settings"];
    return effectiveRole === "vocalist"
      ? ["overview", "profile", "settings", "vocal-profile", "samples"]
      : ["overview", "profile", "settings", "projects", "saved-vocalists"];
  }, [activeUser, effectiveRole]);

  const safeTab = tabs.includes(selectedTab) ? selectedTab : "overview";

  const onLogout = async () => {
    await clearStoredUser();
    window.setTimeout(() => router.push("/"), 150);
  };

  if (!isReady || !activeUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-zinc-300">
        Loading dashboard...
      </main>
    );
  }

  return (
    <InternalShell
      role={effectiveRole}
      isAdmin={isAdmin}
      onAdminRoleChange={() => {
        refresh();
        getStoredUser().then((authUser) => {
          if (authUser) setUserState(authUser);
        });
      }}
      activeItem={safeTab === "overview" ? "dashboard" : safeTab}
    >
      {safeTab === "overview" && <OverviewSection user={activeUser} effectiveRole={effectiveRole} />}
      {safeTab === "profile" && <ProfileSection user={activeUser} onUserChange={setUserState} />}
      {safeTab === "settings" && (
        <SettingsSection user={activeUser} onUserChange={setUserState} onLogout={onLogout} />
      )}
      {safeTab === "vocal-profile" && <Placeholder title="My Vocal Profile" body="Add your genres, range and style tags." />}
      {safeTab === "samples" && <Placeholder title="My Samples" body="Sample management UI will be added next." />}
      {safeTab === "projects" && effectiveRole === "producer" && <ProducerProjectsSection />}
      {safeTab === "projects" && effectiveRole === "vocalist" && (
        <Placeholder title="My Projects" body="Track and manage your vocal search projects." />
      )}
      {safeTab === "saved-vocalists" && <SavedVocalistsRedirect />}
    </InternalShell>
  );
}

function SavedVocalistsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/saved-vocalists");
  }, [router]);
  return (
    <p className="text-sm text-zinc-400">Opening saved vocalists...</p>
  );
}

function OverviewSection({ user, effectiveRole }: { user: AuthUser; effectiveRole: AuthUser["role"] }) {
  const roleCards =
    effectiveRole === "producer"
      ? [
          { title: "My Projects", body: "Track active briefs and matching rounds.", href: "/workspace" },
          { title: "Saved Vocalists", body: "Manage your shortlisted vocal talents.", href: "/saved-vocalists" },
        ]
      : [
          { title: "My Vocal Profile", body: "Tune tags and voice details for better matching.", href: "/dashboard?tab=vocal-profile" },
          { title: "My Samples", body: "Upload and organize your sample catalog.", href: "/dashboard?tab=samples" },
        ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-black/30 p-5">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Account overview for <span className="text-white">{user.username}</span> with quick access to profile and tools.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Role</p>
          <p className="mt-2 text-lg font-medium capitalize text-zinc-100">{effectiveRole}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Email</p>
          <p className="mt-2 text-sm text-zinc-200">{user.email}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Status</p>
          <p className="mt-2 text-sm text-emerald-300">Authenticated</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-black/30 p-5">
          <h3 className="text-lg font-semibold">Account settings</h3>
          <p className="mt-2 text-sm text-zinc-300">Manage your public profile and private account preferences.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <AnimatedButton href="/dashboard?tab=profile" variant="secondary" className="rounded-lg px-4 py-2 text-sm">
              Open profile
            </AnimatedButton>
            <AnimatedButton href="/dashboard?tab=settings" variant="secondary" className="rounded-lg px-4 py-2 text-sm">
              Open settings
            </AnimatedButton>
          </div>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-5">
          <h3 className="text-lg font-semibold">{effectiveRole === "producer" ? "Producer tools" : "Vocalist tools"}</h3>
          <div className="mt-3 space-y-3">
            {roleCards.map((card) => (
              <div key={card.title} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-medium text-zinc-100">{card.title}</p>
                <p className="mt-1 text-xs text-zinc-300">{card.body}</p>
                <AnimatedButton href={card.href} variant="secondary" className="mt-3 rounded-lg px-4 py-2 text-xs">
                  Open
                </AnimatedButton>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function ProfileSection({ user, onUserChange }: { user: AuthUser; onUserChange: (next: AuthUser) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [externalLinks, setExternalLinks] = useState<ExternalLinks>(user.externalLinks ?? {});
  const [linksSaved, setLinksSaved] = useState(false);

  const saveExternalLinks = async () => {
    const updated = await updateStoredUser({ externalLinks });
    if (updated) {
      onUserChange(updated);
      setLinksSaved(true);
      window.setTimeout(() => setLinksSaved(false), 2000);
    }
  };

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const avatar = typeof reader.result === "string" ? reader.result : "";
      const updated = { ...user, avatar };
      saveStoredUser(updated).then(() => {
        onUserChange(updated);
        setIsUploading(false);
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Profile</h2>
      <div className="flex flex-col gap-5 rounded-xl border border-white/10 bg-black/30 p-5 md:flex-row md:items-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-900">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="User avatar preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-zinc-400">No avatar</span>
          )}
        </div>
        <div className="space-y-1 text-sm text-zinc-300">
          <p>
            <span className="text-zinc-500">Username:</span> {user.username}
          </p>
          <p>
            <span className="text-zinc-500">Email:</span> {user.email}
          </p>
          <p>
            <span className="text-zinc-500">Role:</span> {user.role}
          </p>
        </div>
      </div>

      <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/5">
        Upload avatar
        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      </label>
      {isUploading && <p className="text-sm text-zinc-400">Uploading...</p>}

      <ExternalLinksEditor links={externalLinks} onChange={setExternalLinks} />
      <AnimatedButton
        type="button"
        variant="secondary"
        onClick={saveExternalLinks}
        className="rounded-lg px-4 py-2 text-sm"
      >
        Save links
      </AnimatedButton>
      {linksSaved && <p className="text-sm text-emerald-300">Links saved.</p>}
    </div>
  );
}

function SettingsSection({
  user,
  onUserChange,
  onLogout,
}: {
  user: AuthUser;
  onUserChange: (next: AuthUser) => void;
  onLogout: () => void;
}) {
  const [form, setForm] = useState({
    username: user.username,
    email: user.email,
    password: "",
  });
  const [settingsError, setSettingsError] = useState("");
  const [saved, setSaved] = useState(false);

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsError("");

    const updated = {
      ...user,
      username: form.username.trim(),
    };
    await saveStoredUser(updated);

    if (form.email.trim() !== user.email) {
      const { error } = await updateEmail(form.email.trim());
      if (error) {
        setSettingsError(error);
        return;
      }
    }

    if (form.password.length > 0) {
      const { error } = await updatePassword(form.password);
      if (error) {
        setSettingsError(error);
        return;
      }
    }

    onUserChange(updated);
    setForm((prev) => ({ ...prev, password: "" }));
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Settings</h2>

      <form onSubmit={onSave} className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-5">
        <input
          required
          value={form.username}
          onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
          placeholder="Username"
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
        />
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="Email"
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2"
        />
        <PasswordInput
          required
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          placeholder="Password"
        />

        <div className="flex flex-wrap gap-3">
          <AnimatedButton
            type="submit"
            variant="primary"
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Save changes
          </AnimatedButton>
          <AnimatedButton
            type="button"
            variant="secondary"
            onClick={onLogout}
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Logout
          </AnimatedButton>
        </div>
      </form>
      {settingsError && <p className="text-sm text-rose-300">{settingsError}</p>}
      {saved && <p className="text-sm text-emerald-300">Changes saved.</p>}
    </div>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-zinc-300">{body}</div>
    </div>
  );
}
