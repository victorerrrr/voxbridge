"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedButton } from "@/components/animated-button";
import { InternalPageShell } from "@/components/internal-page-shell";
import { createMockWorkspaceProject } from "@/lib/orders";
import { useProducerOrders } from "@/lib/hooks/use-producer-orders";
import { vocalistWorkspaceUrl } from "@/lib/workspace-url";
import { useClientAuth } from "@/lib/hooks/use-client-auth";
import { vocalistIdFromEmail } from "@/lib/vocalist-profile";
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
  const router = useRouter();
  const { user, role, isReady } = useClientAuth();
  const allOrders = useProducerOrders();
  const [projectName, setProjectName] = useState("");

  if (!isReady) {
    return <p className="text-vox-muted">Loading workspace...</p>;
  }

  const vocalistId = user ? vocalistIdFromEmail(user.email) : "";
  const orders =
    role === "vocalist"
      ? allOrders.filter((order) => order.vocalistId === vocalistId)
      : allOrders;

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    const name = projectName.trim() || `Project ${orders.length + 1}`;
    const order = createMockWorkspaceProject(name);
    setProjectName("");
    router.push(`/workspace/${order.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="mt-1 text-vox-secondary">
          {role === "vocalist"
            ? "Open an active collaboration or review past orders."
            : "Select a project or start a new mock workspace."}
        </p>
      </div>

      {role === "producer" && (
        <form
          onSubmit={onCreate}
          className="flex flex-col gap-3 rounded-xl border border-purple-400/20 bg-purple-500/5 p-4 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1.5 block text-zinc-300">New project name</span>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Midnight topline"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm outline-none ring-purple-500/40 focus:ring-2"
            />
          </label>
          <AnimatedButton
            type="submit"
            variant="primary"
            className="inline-flex shrink-0 justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            Create project
          </AnimatedButton>
        </form>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-zinc-950/40 px-6 py-12 text-center">
          <p className="text-vox-secondary">No projects yet.</p>
          {role === "producer" ? (
            <p className="mt-2 text-vox-muted">Create one above or request a vocalist from search.</p>
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
