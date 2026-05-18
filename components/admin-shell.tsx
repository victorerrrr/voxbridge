"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  clearAdminRoleOverride,
  clearStoredUser,
  setAdminRoleOverride,
  type UserRole,
} from "@/lib/auth";
import { InternalBackground } from "@/components/internal-background";

type AdminShellProps = {
  activeItem: string;
  children: ReactNode;
  onPreviewChange?: () => void;
};

const ADMIN_NAV = [
  { key: "overview", label: "Admin Overview", href: "/admin" },
  { key: "users", label: "Users", href: "/admin/users" },
  { key: "vocalists", label: "Vocalists", href: "/admin/vocalists" },
  { key: "producers", label: "Producers", href: "/admin/producers" },
  { key: "orders", label: "Orders", href: "/admin/orders" },
  { key: "workspaces", label: "Workspaces", href: "/admin/workspaces" },
  { key: "messages", label: "Messages", href: "/admin/messages" },
  { key: "reports", label: "Reports", href: "/admin/reports" },
  { key: "moderation", label: "Content Moderation", href: "/admin/moderation" },
  {
    key: "ai-voice-matching",
    label: "AI Voice Lab",
    href: "/admin/ai-voice-matching",
  },
  { key: "settings", label: "Settings", href: "/admin/settings" },
] as const;

const SIDEBAR_WIDTH = "20rem";

export function AdminShell({ activeItem, children, onPreviewChange }: AdminShellProps) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const mediaMobile = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobile(mediaMobile.matches);
      setIsSidebarOpen(!mediaMobile.matches);
    };
    sync();
    mediaMobile.addEventListener("change", sync);
    return () => mediaMobile.removeEventListener("change", sync);
  }, []);

  const onLogout = () => {
    clearAdminRoleOverride();
    clearStoredUser();
    window.setTimeout(() => router.push("/"), 150);
  };

  const enterPreview = (role: UserRole) => {
    setAdminRoleOverride(role);
    onPreviewChange?.();
    router.push("/home");
  };

  const sidebarVisible = !isMobile || isSidebarOpen;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <InternalBackground />

      <header className="fixed left-0 right-0 top-0 z-[70] flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-zinc-950/80 text-zinc-100 backdrop-blur-xl"
            >
              <MenuIcon />
            </button>
          )}
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3.5 py-2 text-sm font-semibold tracking-wide text-amber-50 backdrop-blur-xl transition hover:border-amber-300/60"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400" />
            VoxBridge Admin
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-xs text-zinc-500 sm:inline">Preview:</span>
          <button
            type="button"
            onClick={() => enterPreview("producer")}
            className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/20"
          >
            View as Producer
          </button>
          <button
            type="button"
            onClick={() => enterPreview("vocalist")}
            className="rounded-full border border-purple-400/35 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100 transition hover:bg-purple-500/20"
          >
            View as Vocalist
          </button>
        </div>
      </header>

      <div
        className="relative z-10 flex min-h-screen"
        style={{ paddingLeft: !isMobile ? SIDEBAR_WIDTH : undefined }}
      >
        {isMobile && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] transition-opacity duration-300 ${
              sidebarVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!sidebarVisible}
          />
        )}

        <aside
          style={{ width: SIDEBAR_WIDTH }}
          className={`fixed inset-y-0 left-0 z-[60] flex flex-col border-r border-amber-500/15 bg-gradient-to-b from-zinc-950/95 via-zinc-950/92 to-black/95 pb-5 shadow-[0_0_90px_rgba(251,191,36,0.12)] backdrop-blur-2xl transition-transform duration-300 ease-out ${
            sidebarVisible ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className={`flex-1 space-y-1 overflow-y-auto px-4 ${isMobile ? "pt-20" : "pt-24"}`}>
            <p className="px-1 pb-2 text-[11px] uppercase tracking-[0.18em] text-amber-200/50">
              Control center
            </p>
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => isMobile && setIsSidebarOpen(false)}
                className={`flex items-center rounded-xl px-3 py-2.5 text-sm transition ${
                  activeItem === item.key
                    ? "bg-gradient-to-r from-amber-500/25 via-orange-500/15 to-rose-500/12 text-white ring-1 ring-amber-400/35"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 flex w-full items-center rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-rose-400/55 hover:bg-rose-500/12 hover:text-rose-100"
            >
              Logout
            </button>
          </nav>
        </aside>

        <section className="relative z-10 w-full min-w-0 p-4 pt-[5.5rem] md:p-6 md:pt-[5.5rem]">
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
