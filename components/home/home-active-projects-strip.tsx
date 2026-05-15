"use client";

import Link from "next/link";
import {
  getHomeOrderStatusLabel,
  getHomeOrderStatusStyle,
  isHomeActiveOrderStatus,
} from "@/components/home/home-order-status";
import { useProducerOrders } from "@/lib/hooks/use-producer-orders";
import type { UserRole } from "@/lib/auth";
import { getActiveVocalistOrder, ensureVocalistRequestsSeeded } from "@/lib/vocalist-requests";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";
import { getOrdersForVocalist, type ProducerOrder } from "@/lib/orders";
import { vocalistWorkspaceUrl } from "@/lib/workspace-url";
import { useEffect, useMemo } from "react";

export type HomeViewMode = "all" | "projects";

type HomeActiveProjectsStripProps = {
  role: UserRole;
  email: string;
  viewMode: HomeViewMode;
  onViewModeChange: (mode: HomeViewMode) => void;
  onSelectProjectTrack?: (order: ProducerOrder) => void;
};

const PROJECT_GRADIENTS = [
  "from-purple-600/50 via-fuchsia-600/30 to-cyan-600/40",
  "from-indigo-600/45 via-purple-600/35 to-pink-600/35",
  "from-cyan-600/40 via-blue-600/35 to-purple-600/40",
  "from-violet-600/45 via-purple-500/35 to-amber-500/25",
  "from-emerald-600/35 via-cyan-600/35 to-purple-600/40",
];

export function useHomeActiveProjects(role: UserRole, email: string) {
  const producerOrders = useProducerOrders();

  useEffect(() => {
    if (role === "vocalist") ensureVocalistRequestsSeeded();
  }, [role]);

  return useMemo(() => {
    if (role === "producer") {
      return producerOrders.filter((order) => isHomeActiveOrderStatus(order.status));
    }
    const vocalistId = vocalistIdFromEmail(email);
    const fromVocalist = getOrdersForVocalist(vocalistId).filter((order) =>
      isHomeActiveOrderStatus(order.status)
    );
    if (fromVocalist.length > 0) return fromVocalist;
    const active = getActiveVocalistOrder();
    return active ? [active] : [];
  }, [role, email, producerOrders]);
}

export function HomeActiveProjectsStrip({
  role,
  email,
  viewMode,
  onViewModeChange,
}: HomeActiveProjectsStripProps) {
  const projects = useHomeActiveProjects(role, email);
  const projectsHref = role === "producer" ? "/dashboard?tab=projects" : "/vocalist/orders";

  return (
    <div className="shrink-0 border-b border-white/10 bg-zinc-950/70 px-2 py-2 backdrop-blur-sm md:px-3">
      <div className="flex flex-wrap items-center gap-2">
        <ViewTab active={viewMode === "all"} onClick={() => onViewModeChange("all")}>
          All tracks
        </ViewTab>
        <ViewTab
          active={viewMode === "projects"}
          onClick={() => onViewModeChange("projects")}
          badge={projects.length > 0 ? projects.length : undefined}
        >
          Active projects
        </ViewTab>

        {projects.length > 0 && (
          <div className="ml-0 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5 md:ml-2">
            {projects.slice(0, 8).map((order, index) => {
              const statusLabel = getHomeOrderStatusLabel(order.status);
              const workspaceHref =
                role === "vocalist" ? vocalistWorkspaceUrl(order.id) : `/workspace/${order.id}`;
              const gradient = PROJECT_GRADIENTS[index % PROJECT_GRADIENTS.length];

              return (
                <Link
                  key={order.id}
                  href={workspaceHref}
                  className="group relative flex h-[4.25rem] w-[9.5rem] shrink-0 flex-col justify-end overflow-hidden rounded-xl border border-white/10 p-2.5 transition hover:scale-[1.03] hover:border-purple-400/35 hover:shadow-[0_0_24px_rgba(168,85,247,0.2)]"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-80 transition group-hover:opacity-100`}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.12),transparent_55%)]" aria-hidden />
                  <span className="relative z-10 line-clamp-2 text-xs font-semibold leading-tight text-white">
                    {order.trackName}
                  </span>
                  <span
                    className={`relative z-10 mt-1 inline-flex w-fit rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wide ${getHomeOrderStatusStyle(statusLabel)}`}
                  >
                    {statusLabel}
                  </span>
                </Link>
              );
            })}
            <Link
              href={projectsHref}
              className="flex h-[4.25rem] w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 text-[10px] font-medium uppercase tracking-wide text-zinc-500 transition hover:border-purple-400/30 hover:text-zinc-300"
            >
              All
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewTab({
  children,
  active,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-gradient-to-r from-purple-500/35 to-cyan-500/15 text-white ring-1 ring-purple-400/35 shadow-[0_0_18px_rgba(168,85,247,0.2)]"
          : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      {children}
      {badge !== undefined ? (
        <span className="rounded-full bg-purple-500/30 px-1.5 py-px text-[10px] text-purple-200">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
