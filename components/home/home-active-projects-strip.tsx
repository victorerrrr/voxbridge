"use client";

import { AnimatedButton } from "@/components/animated-button";
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
import { useEffect, useMemo, type ReactNode } from "react";

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

function projectCollaboratorLabel(order: ProducerOrder, role: UserRole): string {
  return role === "producer"
    ? `with ${order.vocalistName}`
    : order.producerName ?? "Producer";
}

export function HomeActiveProjectsStrip({
  role,
  email,
  viewMode,
  onViewModeChange,
}: HomeActiveProjectsStripProps) {
  const projects = useHomeActiveProjects(role, email);
  const projectsHref = role === "producer" ? "/workspace" : "/vocalist/orders";
  const showList = projects.length > 1;

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

        {projects.length === 1 && (
          <div className="ml-0 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5 md:ml-2">
            <ProjectChip order={projects[0]} role={role} index={0} />
            <AnimatedButton
              href={projectsHref}
              variant="secondary"
              className="h-[4.5rem] w-14 shrink-0 rounded-xl border border-dashed border-white/15 px-0 text-[11px] font-medium uppercase tracking-wide"
            >
              All
            </AnimatedButton>
          </div>
        )}

        {projects.length > 1 && (
          <AnimatedButton
            href={projectsHref}
            variant="secondary"
            className="ml-auto rounded-full px-3 py-1.5 text-vox-meta"
          >
            All projects ({projects.length})
          </AnimatedButton>
        )}
      </div>

      {showList && (
        <ul className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
          {projects.map((order) => {
            const statusLabel = getHomeOrderStatusLabel(order.status);
            const workspaceHref =
              role === "vocalist" ? vocalistWorkspaceUrl(order.id) : `/workspace/${order.id}`;
            const title = order.projectName || order.trackName;

            return (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-zinc-900/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{title}</p>
                  <p className="truncate text-vox-meta">{projectCollaboratorLabel(order, role)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${getHomeOrderStatusStyle(statusLabel)}`}
                  >
                    {statusLabel}
                  </span>
                  <AnimatedButton
                    href={workspaceHref}
                    variant="primary"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    Open workspace
                  </AnimatedButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectChip({
  order,
  role,
  index,
}: {
  order: ProducerOrder;
  role: UserRole;
  index: number;
}) {
  const statusLabel = getHomeOrderStatusLabel(order.status);
  const workspaceHref =
    role === "vocalist" ? vocalistWorkspaceUrl(order.id) : `/workspace/${order.id}`;
  const gradient = PROJECT_GRADIENTS[index % PROJECT_GRADIENTS.length];
  const title = order.projectName || order.trackName;

  return (
    <div className="group relative flex h-[4.5rem] w-[10.5rem] shrink-0 flex-col justify-end overflow-hidden rounded-xl border border-white/10 p-2.5">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-80 transition group-hover:opacity-100`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.12),transparent_55%)]"
        aria-hidden
      />
      <span className="relative z-10 line-clamp-2 text-sm font-medium leading-tight text-white">
        {title}
      </span>
      <span className="relative z-10 mt-0.5 line-clamp-1 text-[11px] text-zinc-300">
        {projectCollaboratorLabel(order, role)}
      </span>
      <span
        className={`relative z-10 mt-1 inline-flex w-fit rounded-full border px-1.5 py-px text-[10px] uppercase tracking-wide ${getHomeOrderStatusStyle(statusLabel)}`}
      >
        {statusLabel}
      </span>
      <AnimatedButton
        href={workspaceHref}
        variant="primary"
        className="relative z-10 mt-1.5 w-full rounded-md px-2 py-1 text-[11px] font-medium"
      >
        Open
      </AnimatedButton>
    </div>
  );
}

function ViewTab({
  children,
  active,
  onClick,
  badge,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-gradient-to-r from-purple-500/35 to-cyan-500/15 text-white ring-1 ring-purple-400/35 shadow-[0_0_18px_rgba(168,85,247,0.2)]"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      {children}
      {badge !== undefined ? (
        <span className="rounded-full bg-purple-500/30 px-1.5 py-px text-xs text-purple-200">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
