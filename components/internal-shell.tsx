"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  clearAdminRoleOverride,
  clearStoredUser,
  getStoredUser,
  setAdminRoleOverride,
  type UserRole,
} from "@/lib/auth";
import { InternalBackground } from "@/components/internal-background";
import { isHomeActiveOrderStatus } from "@/components/home/home-order-status";
import { getOrdersForVocalist } from "@/lib/orders";
import { vocalistWorkspaceUrl } from "@/lib/workspace-url";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";

type InternalShellProps = {
  role: UserRole;
  isAdmin?: boolean;
  onAdminRoleChange?: () => void;
  activeItem?: string;
  children: ReactNode;
  contentVariant?: "default" | "workspace";
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

type SidebarMode = "pinned" | "auto";

const SIDEBAR_MODE_KEY = "voxbridge_sidebar_mode";
const SIDEBAR_CLOSE_DELAY_MS = 200;
const SIDEBAR_WIDTH = "20rem";

const producerMainGroup: SidebarGroup = {
  key: "main",
  title: "Main",
  items: [
    { key: "home", label: "Home", href: "/home" },
    { key: "upload", label: "Upload AI Vocal", href: "/search" },
  ],
};

const producerAccountGroup: SidebarGroup = {
  key: "account",
  title: "Account",
  items: [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "profile", label: "Profile", href: "/dashboard?tab=profile" },
    { key: "settings", label: "Settings", href: "/dashboard?tab=settings" },
  ],
};

const producerToolsGroup: SidebarGroup = {
  key: "producer-tools",
  title: "Producer tools",
  items: [
    { key: "workspace", label: "Workspace", href: "/workspace" },
    { key: "projects", label: "My Projects", href: "/workspace" },
    { key: "saved-vocalists", label: "Saved Vocalists", href: "/saved-vocalists" },
  ],
};

function buildVocalistGroups(workspaceHref: string | null, profileHref: string): SidebarGroup[] {
  const workItems: SidebarItem[] = [
    { key: "orders", label: "Orders", href: "/vocalist/orders" },
    { key: "workspace", label: "Workspace", href: "/workspace" },
  ];
  if (workspaceHref) {
    workItems.push({ key: "active-workspace", label: "Active project", href: workspaceHref });
  }

  return [
    {
      key: "main",
      title: "Main",
      items: [{ key: "home", label: "Home", href: "/home" }],
    },
    {
      key: "work",
      title: "Work",
      items: workItems,
    },
    {
      key: "profile",
      title: "Profile",
      items: [
        { key: "my-profile", label: "My Profile", href: profileHref },
        { key: "samples", label: "My Demos", href: "/vocalist/demos" },
      ],
    },
    {
      key: "system",
      title: "System",
      items: [{ key: "settings", label: "Settings", href: "/dashboard?tab=settings" }],
    },
  ];
}

function readSidebarMode(): SidebarMode {
  if (typeof window === "undefined") return "pinned";
  const stored = window.localStorage.getItem(SIDEBAR_MODE_KEY);
  return stored === "auto" ? "auto" : "pinned";
}

export default function InternalShell({
  role,
  isAdmin = false,
  onAdminRoleChange,
  activeItem,
  children,
  contentVariant = "default",
}: InternalShellProps) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("pinned");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hoverUiEnabled, setHoverUiEnabled] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setSidebarMode(readSidebarMode());
    const mediaMobile = window.matchMedia("(max-width: 767px)");
    const mediaHover = window.matchMedia("(hover: hover) and (pointer: fine)");

    const sync = () => {
      setIsMobile(mediaMobile.matches);
      setHoverUiEnabled(mediaHover.matches);
      if (mediaMobile.matches) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(readSidebarMode() === "pinned");
      }
    };

    sync();
    mediaMobile.addEventListener("change", sync);
    mediaHover.addEventListener("change", sync);
    return () => {
      mediaMobile.removeEventListener("change", sync);
      mediaHover.removeEventListener("change", sync);
    };
  }, []);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearCloseTimeout, [clearCloseTimeout]);

  const persistSidebarMode = useCallback((mode: SidebarMode) => {
    setSidebarMode(mode);
    window.localStorage.setItem(SIDEBAR_MODE_KEY, mode);
    if (!isMobile) {
      setIsSidebarOpen(mode === "pinned");
    }
  }, [isMobile]);

  const closeMobileSidebar = useCallback(() => {
    if (!isMobile) return;
    clearCloseTimeout();
    setIsSidebarOpen(false);
  }, [clearCloseTimeout, isMobile]);

  const openMobileSidebar = useCallback(() => {
    if (!isMobile) return;
    clearCloseTimeout();
    setIsSidebarOpen(true);
  }, [clearCloseTimeout, isMobile]);

  const handleSidebarHoverEnter = useCallback(() => {
    if (isMobile || sidebarMode !== "auto" || !hoverUiEnabled) return;
    clearCloseTimeout();
    setIsSidebarOpen(true);
  }, [clearCloseTimeout, hoverUiEnabled, isMobile, sidebarMode]);

  const scheduleSidebarHoverClose = useCallback(() => {
    if (isMobile || sidebarMode !== "auto" || !hoverUiEnabled) return;
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsSidebarOpen(false);
      closeTimeoutRef.current = null;
    }, SIDEBAR_CLOSE_DELAY_MS);
  }, [clearCloseTimeout, hoverUiEnabled, isMobile, sidebarMode]);

  const desktopSidebarVisible = !isMobile && (sidebarMode === "pinned" || isSidebarOpen);

  const vocalistNavFallback = {
    workspaceHref: null as string | null,
    profileHref: "/dashboard?tab=vocal-profile",
  };
  const [vocalistNav, setVocalistNav] = useState(vocalistNavFallback);

  useEffect(() => {
    if (role !== "vocalist") {
      setVocalistNav(vocalistNavFallback);
      return;
    }
    let cancelled = false;
    getStoredUser().then((user) => {
      if (cancelled) return;
      if (!user) {
        setVocalistNav(vocalistNavFallback);
        return;
      }
      const vocalistId = vocalistIdFromEmail(user.email);
      const activeOrders = getOrdersForVocalist(vocalistId).filter((order) =>
        isHomeActiveOrderStatus(order.status)
      );
      setVocalistNav({
        workspaceHref:
          activeOrders.length === 1 ? vocalistWorkspaceUrl(activeOrders[0].id) : null,
        profileHref: `/vocalists/${vocalistId}`,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const { workspaceHref, profileHref } =
    role === "vocalist" ? vocalistNav : vocalistNavFallback;

  const menuGroups = useMemo(() => {
    if (role === "producer") {
      return [producerMainGroup, producerAccountGroup, producerToolsGroup];
    }
    return buildVocalistGroups(workspaceHref, profileHref);
  }, [role, workspaceHref, profileHref]);

  const onLogout = async () => {
    closeMobileSidebar();
    await clearStoredUser();
    window.setTimeout(() => router.push("/"), 150);
  };

  const onNavClick = () => {
    closeMobileSidebar();
  };

  const roleBadgeClass =
    role === "producer"
      ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-100"
      : "border-purple-400/35 bg-purple-500/10 text-purple-100";

  const onSelectAdminRole = (next: UserRole) => {
    if (role === next) return;
    setAdminRoleOverride(next);
    onAdminRoleChange?.();
  };

  const onBackToAdmin = () => {
    clearAdminRoleOverride();
    onAdminRoleChange?.();
    router.push("/admin");
  };

  const onTogglePin = () => {
    persistSidebarMode(sidebarMode === "pinned" ? "auto" : "pinned");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <InternalBackground />

      <div className="fixed left-0 right-0 top-0 z-[70] flex items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button
              type="button"
              onClick={openMobileSidebar}
              aria-label="Open menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-zinc-950/80 text-zinc-100 backdrop-blur-xl"
            >
              <MenuIcon />
            </button>
          )}
          <Link
            href="/home"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-zinc-950/80 px-3.5 py-2 text-sm font-semibold tracking-wide text-white backdrop-blur-xl transition hover:border-purple-300/60"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-300" />
            VoxBridge
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div
              role="group"
              aria-label="Admin role"
              className="flex rounded-full border border-amber-400/35 bg-amber-500/10 p-0.5 text-xs font-medium"
            >
              <button
                type="button"
                onClick={() => onSelectAdminRole("producer")}
                className={`rounded-full px-3 py-1 transition ${
                  role === "producer"
                    ? "bg-amber-400/25 text-amber-50"
                    : "text-amber-200/70 hover:text-amber-100"
                }`}
              >
                Producer
              </button>
              <button
                type="button"
                onClick={() => onSelectAdminRole("vocalist")}
                className={`rounded-full px-3 py-1 transition ${
                  role === "vocalist"
                    ? "bg-amber-400/25 text-amber-50"
                    : "text-amber-200/70 hover:text-amber-100"
                }`}
              >
                Vocalist
              </button>
            </div>
          )}
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${roleBadgeClass}`}
          >
            {isAdmin ? `Preview: ${role}` : role === "producer" ? "Producer mode" : "Vocalist mode"}
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={onBackToAdmin}
              className="rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-amber-500/20"
            >
              Back to Admin
            </button>
          )}
        </div>
      </div>

      {!isMobile && sidebarMode === "auto" && !isSidebarOpen && (
        <div
          className="fixed bottom-0 left-0 top-0 z-[55] w-3"
          onMouseEnter={handleSidebarHoverEnter}
          aria-hidden
        />
      )}

      <div
        className="relative z-10 flex min-h-screen"
        style={{ paddingLeft: desktopSidebarVisible ? SIDEBAR_WIDTH : undefined }}
      >
        {isMobile && (
          <button
            type="button"
            onClick={closeMobileSidebar}
            className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] transition-opacity duration-300 ${
              isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!isSidebarOpen}
          />
        )}

        <aside
          onMouseEnter={handleSidebarHoverEnter}
          onMouseLeave={scheduleSidebarHoverClose}
          style={{ width: SIDEBAR_WIDTH }}
          className={`fixed inset-y-0 left-0 z-[60] flex flex-col border-r border-white/10 bg-gradient-to-b from-zinc-950/95 via-zinc-950/92 to-black/95 pb-5 shadow-[0_0_90px_rgba(167,139,250,0.2)] backdrop-blur-2xl transition-transform duration-300 ease-out ${
            isMobile
              ? isSidebarOpen
                ? "translate-x-0"
                : "-translate-x-full"
              : desktopSidebarVisible
                ? "translate-x-0"
                : "-translate-x-full"
          }`}
        >
          {!isMobile && (
            <div className="flex justify-end border-b border-white/10 px-4 pb-3 pt-[4.5rem]">
              <button
                type="button"
                onClick={onTogglePin}
                aria-label={sidebarMode === "pinned" ? "Unpin sidebar" : "Pin sidebar"}
                aria-pressed={sidebarMode === "pinned"}
                title={sidebarMode === "pinned" ? "Sidebar pinned open" : "Sidebar auto-hides"}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  sidebarMode === "pinned"
                    ? "border-purple-400/45 bg-purple-500/20 text-purple-100"
                    : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                <PinIcon pinned={sidebarMode === "pinned"} />
              </button>
            </div>
          )}

          <nav className={`flex-1 space-y-5 overflow-y-auto px-4 ${isMobile ? "pt-20" : ""}`}>
            {menuGroups.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{group.title}</p>
                {group.items.map((item) => {
                  const isActive = activeItem === item.key;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={onNavClick}
                      className={`flex items-center rounded-xl px-3 py-2.5 text-sm transition ${
                        isActive
                          ? "bg-gradient-to-r from-purple-500/30 via-blue-500/18 to-cyan-400/16 text-white ring-1 ring-purple-300/40"
                          : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}

            {role === "producer" && (
              <p className="px-1 pt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">System</p>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-rose-400/55 hover:bg-rose-500/12 hover:text-rose-100"
            >
              Logout
            </button>
          </nav>
        </aside>

        <section
          className={`relative z-10 w-full min-w-0 p-4 pt-[4.5rem] md:p-6 md:pt-[4.5rem] ${
            contentVariant === "workspace" ? "" : ""
          }`}
        >
          {contentVariant === "workspace" ? (
            children
          ) : (
            <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-zinc-950/65 p-4 backdrop-blur-xl md:p-6">
              {children}
            </div>
          )}
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

function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path
        d="M12 17v5M9 3h6l1 7h4l-5 6v4H9v-4L4 10h4l1-7z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
