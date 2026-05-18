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
import { getOrdersForVocalist } from "@/lib/orders";
import { vocalistWorkspaceUrl } from "@/lib/workspace-url";
import { useEffect, useMemo } from "react";

type HomeActiveProjectsProps = {
  role: UserRole;
  email: string;
};

export function HomeActiveProjects({ role, email }: HomeActiveProjectsProps) {
  const producerOrders = useProducerOrders();

  useEffect(() => {
    if (role === "vocalist") ensureVocalistRequestsSeeded();
  }, [role]);

  const projects = useMemo(() => {
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

  if (projects.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHeader title="Active projects" href={role === "producer" ? "/workspace" : "/vocalist/orders"} />
      <div className="grid gap-2.5">
        {projects.map((order) => {
          const statusLabel = getHomeOrderStatusLabel(order.status);
          const workspaceHref =
            role === "vocalist" ? vocalistWorkspaceUrl(order.id) : `/workspace/${order.id}`;

          return (
            <article
              key={order.id}
              className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-400/25 bg-gradient-to-r from-purple-500/10 via-zinc-950/80 to-cyan-500/5 p-3.5 transition hover:border-purple-300/45 hover:shadow-[0_0_32px_rgba(168,85,247,0.18)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {order.projectName || order.trackName}
                </p>
                <p className="mt-0.5 truncate text-vox-meta">
                  {role === "producer" ? `with ${order.vocalistName}` : order.producerName ?? "Producer"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${getHomeOrderStatusStyle(statusLabel)}`}
                >
                  {statusLabel}
                </span>
                <AnimatedButton
                  href={workspaceHref}
                  variant="primary"
                  className="rounded-lg px-3.5 py-2 text-sm font-medium"
                >
                  Open workspace
                </AnimatedButton>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-vox-label text-zinc-300">{title}</h2>
      <AnimatedButton href={href} variant="secondary" className="rounded-lg px-2.5 py-1.5 text-xs">
        View all
      </AnimatedButton>
    </div>
  );
}