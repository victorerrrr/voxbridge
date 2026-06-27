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
import { useEffect, useMemo, useState } from "react";

type HomeActiveProjectsStripProps = {
  role: UserRole;
  email: string;
  compact?: boolean;
};

export function useHomeActiveProjects(role: UserRole, email: string) {
  const producerOrders = useProducerOrders();
  const [fallbackOrder, setFallbackOrder] = useState<ProducerOrder | null>(null);

  useEffect(() => {
    if (role === "vocalist") ensureVocalistRequestsSeeded();
  }, [role]);

  useEffect(() => {
    if (role !== "vocalist") {
      setFallbackOrder(null);
      return;
    }
    let cancelled = false;
    getActiveVocalistOrder().then((order) => {
      if (!cancelled) setFallbackOrder(order ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [role, email]);

  return useMemo(() => {
    if (role === "producer") {
      return producerOrders.filter((order) => isHomeActiveOrderStatus(order.status));
    }
    const vocalistId = vocalistIdFromEmail(email);
    const fromVocalist = getOrdersForVocalist(vocalistId).filter((order) =>
      isHomeActiveOrderStatus(order.status)
    );
    if (fromVocalist.length > 0) return fromVocalist;
    return fallbackOrder ? [fallbackOrder] : [];
  }, [role, email, producerOrders, fallbackOrder]);
}

function projectCollaboratorLabel(order: ProducerOrder, role: UserRole): string {
  return role === "producer"
    ? `with ${order.vocalistName}`
    : order.producerName ?? "Producer";
}

export function HomeActiveProjectsStrip({
  role,
  email,
  compact = false,
}: HomeActiveProjectsStripProps) {
  const projects = useHomeActiveProjects(role, email);

  if (projects.length === 0) return null;

  if (compact) {
    return (
      <section className="shrink-0 border-t border-white/[0.06] px-5 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-vox-label mb-3 normal-case tracking-normal text-zinc-600">
            Continue working
          </h2>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {projects.map((order) => (
              <CompactProjectCard key={order.id} order={order} role={role} />
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="shrink-0 border-b border-white/[0.06] px-3 py-2.5 md:px-4">
      <h2 className="text-vox-label mb-2 normal-case tracking-normal text-zinc-500">
        Continue working
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {projects.map((order) => {
          const statusLabel = getHomeOrderStatusLabel(order.status);
          const workspaceHref =
            role === "vocalist" ? vocalistWorkspaceUrl(order.id) : `/workspace/${order.id}`;
          const title = order.projectName || order.trackName;

          return (
            <li
              key={order.id}
              className="flex w-[min(100%,14rem)] shrink-0 flex-col gap-1.5 rounded-xl border border-white/[0.08] bg-zinc-900/60 p-2.5 backdrop-blur-sm"
            >
              <p className="truncate text-sm font-medium text-white">{title}</p>
              <p className="truncate text-vox-meta">{projectCollaboratorLabel(order, role)}</p>
              <span
                className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${getHomeOrderStatusStyle(statusLabel)}`}
              >
                {statusLabel}
              </span>
              <AnimatedButton
                href={workspaceHref}
                variant="primary"
                className="mt-0.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                Open workspace
              </AnimatedButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CompactProjectCard({
  order,
  role,
}: {
  order: ProducerOrder;
  role: UserRole;
}) {
  const statusLabel = getHomeOrderStatusLabel(order.status);
  const workspaceHref =
    role === "vocalist" ? vocalistWorkspaceUrl(order.id) : `/workspace/${order.id}`;
  const title = order.projectName || order.trackName;

  return (
    <li className="flex w-[min(100%,12rem)] shrink-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-zinc-900/40 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <p className="truncate text-[11px] text-zinc-500">{statusLabel}</p>
      </div>
      <AnimatedButton
        href={workspaceHref}
        variant="secondary"
        className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium"
      >
        Open
      </AnimatedButton>
    </li>
  );
}
