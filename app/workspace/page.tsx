"use client";

import { useEffect, useState } from "react";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { useProducerOrders } from "@/lib/hooks/use-producer-orders";
import { vocalistWorkspaceUrl } from "@/lib/workspace-url";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { getVocalistProfileByOwnerId } from "@/lib/vocalist-profile";
import {
  getHomeOrderStatusLabel,
  getHomeOrderStatusStyle,
} from "@/components/home/home-order-status";

export default function WorkspaceListPage() {
  return (
    <InternalPageShell activeItem="workspace">
      <WorkspaceListContent />
    </InternalPageShell>
  );
}

function WorkspaceListContent() {
  const { user, role, isReady } = useClientAuth();
  const allOrders = useProducerOrders();
  const [vocalistId, setVocalistId] = useState("");

  useEffect(() => {
    if (!user) {
      setVocalistId("");
      return;
    }
    let cancelled = false;
    getVocalistProfileByOwnerId(user.id).then((profile) => {
      if (!cancelled) setVocalistId(profile?.id ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!isReady) {
    return <p className="text-vox-muted">Loading workspace...</p>;
  }

  const orders =
    role === "vocalist"
      ? allOrders.filter((order) => order.vocalistId === vocalistId)
      : allOrders;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="mt-1 text-vox-secondary">
          {role === "vocalist"
            ? "Open an active collaboration or review past orders."
            : "Select a project to open its workspace."}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-zinc-950/40 px-6 py-12 text-center">
          <p className="text-vox-secondary">No projects yet.</p>
          {role === "producer" ? (
            <AnimatedButton
              href="/search"
              variant="secondary"
              className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm"
            >
              Find a vocalist
            </AnimatedButton>
          ) : (
            <AnimatedButton
              href="/vocalist/orders"
              variant="secondary"
              className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm"
            >
              View orders
            </AnimatedButton>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => {
            const href =
              role === "vocalist" ? vocalistWorkspaceUrl(order.id) : `/workspace/${order.id}`;
            const title = order.projectName || order.trackName;
            const statusLabel = getHomeOrderStatusLabel(order.status);
            const collaborator =
              role === "vocalist" ? order.producerName || "Producer" : order.vocalistName;

            return (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/50 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{title}</p>
                  <p className="mt-0.5 truncate text-vox-meta">{collaborator}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getHomeOrderStatusStyle(statusLabel)}`}
                  >
                    {statusLabel}
                  </span>
                  <AnimatedButton
                    href={href}
                    variant="primary"
                    className="rounded-lg px-4 py-2 text-sm font-medium"
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
