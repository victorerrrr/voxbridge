"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearStoredUser, type UserRole } from "@/lib/auth";
import { InternalBackground } from "@/components/internal-background";

type InternalShellProps = {
  role: UserRole;
  activeItem?: string;
  children: ReactNode;
};

type SidebarItem = {
  key: string;
  label: string;
  href: string;
};

type SidebarGroup = {
  key: string;
  title: string;
  items: SidebarItem[];
};

const mainGroup: SidebarGroup = {
  key: "main",
  title: "Main",
  items: [
    { key: "home", label: "Home", href: "/home" },
    { key: "explore", label: "Explore / Search", href: "/search" },
  ],
};

const accountGroup: SidebarGroup = {
  key: "account",
  title: "Account",
  items: [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "profile", label: "Profile", href: "/dashboard?tab=profile" },
    { key: "settings", label: "Settings", href: "/dashboard?tab=settings" },
  ],
};

const roleGroup: Record<UserRole, SidebarGroup> = {
  producer: {
    key: "producer-tools",
    title: "Producer tools",
    items: [
      { key: "projects", label: "My Projects", href: "/dashboard?tab=projects" },
      { key: "saved-vocalists", label: "Saved Vocalists", href: "/dashboard?tab=saved-vocalists" },
    ],
  },
  vocalist: {
    key: "vocalist-tools",
    title: "Vocalist tools",
    items: [
      { key: "vocal-profile", label: "My Vocal Profile", href: "/dashboard?tab=vocal-profile" },
      { key: "samples", label: "My Samples", href: "/dashboard?tab=samples" },
    ],
  },
};

export default function InternalShell({ role, activeItem, children }: InternalShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();
  const menuGroups = [mainGroup, accountGroup, roleGroup[role]];

  const onLogout = () => {
    setIsSidebarOpen(false);
    clearStoredUser();
    window.setTimeout(() => router.push("/"), 150);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <InternalBackground />

      <Link
        href="/home"
        className="fixed left-6 top-5 z-[70] inline-flex items-center gap-2 rounded-xl border border-white/20 bg-zinc-950/80 px-3.5 py-2 text-sm font-semibold tracking-wide text-white backdrop-blur-xl transition hover:border-purple-300/60 hover:shadow-[0_0_28px_rgba(168,85,247,0.35)]"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.7)]" />
        VoxBridge
      </Link>

      <button
        type="button"
        onMouseEnter={() => setIsSidebarOpen(true)}
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Open sidebar"
        className="fixed left-6 top-20 z-[65] inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-zinc-950/80 text-zinc-100 backdrop-blur-xl transition duration-300 hover:border-cyan-300/55 hover:shadow-[0_0_26px_rgba(56,189,248,0.35)]"
      >
        <MenuIcon />
      </button>

      <div className="relative z-10 flex min-h-screen">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] transition-opacity duration-300 ${
            isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!isSidebarOpen}
        />

        <aside
          className={`fixed inset-y-0 left-0 z-60 flex w-80 flex-col border-r border-white/10 bg-gradient-to-b from-zinc-950/95 via-zinc-950/92 to-black/95 pb-5 pt-24 shadow-[0_0_90px_rgba(167,139,250,0.2)] backdrop-blur-2xl transition-transform duration-300 ease-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 flex items-center justify-end px-4">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-200 transition hover:border-pink-400/55 hover:text-white hover:shadow-[0_0_24px_rgba(236,72,153,0.35)]"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="space-y-5 px-4">
            {menuGroups.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{group.title}</p>
                {group.items.map((item) => {
                  const isActive = activeItem === item.key;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center rounded-xl px-3 py-2.5 text-sm transition ${
                        isActive
                          ? "bg-gradient-to-r from-purple-500/30 via-blue-500/18 to-cyan-400/16 text-white ring-1 ring-purple-300/40 shadow-[0_0_24px_rgba(147,51,234,0.24)]"
                          : "text-zinc-300 hover:bg-gradient-to-r hover:from-purple-500/20 hover:via-blue-500/10 hover:to-pink-500/15 hover:text-white hover:shadow-[0_0_22px_rgba(56,189,248,0.2)]"
                      }`}
                      title={item.label}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}

            <div className="pointer-events-none h-px w-full bg-gradient-to-r from-purple-400/40 via-cyan-300/25 to-pink-400/40" />
            <p className="px-1 pt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">System</p>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-rose-400/55 hover:bg-rose-500/12 hover:text-rose-100 hover:shadow-[0_0_18px_rgba(244,63,94,0.25)]"
            >
              Logout
            </button>
          </nav>
        </aside>

        <section className="relative z-10 w-full p-4 pt-24 md:p-8 md:pt-24">
          <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-zinc-950/65 p-4 backdrop-blur-xl md:p-6">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
