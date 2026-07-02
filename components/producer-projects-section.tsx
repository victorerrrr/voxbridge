"use client";

import { AnimatedButton } from "@/components/animated-button";
import { useProducerOrders } from "@/lib/hooks/use-producer-orders";
import { orderStatusLabel, type ProducerOrder } from "@/lib/orders";

export function ProducerProjectsSection() {
  const orders = useProducerOrders();

  const active = orders.filter((order) => order.status !== "completed");
  const completed = orders.filter((order) => order.status === "completed");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">My Projects</h2>
          <p className="mt-2 text-vox-secondary">
            Producer orders — request → accept → workspace → review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AnimatedButton
            href="/workspace"
            variant="secondary"
            className="inline-flex rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            All projects
          </AnimatedButton>
          <AnimatedButton
            href="/search"
            variant="primary"
            className="inline-flex rounded-lg px-5 py-2.5 text-sm font-medium"
          >
            New upload
          </AnimatedButton>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-zinc-300">
          <p>No projects yet. Open a vocalist profile and send a request to start.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <AnimatedButton
              href="/my-requests"
              variant="secondary"
              className="inline-flex rounded-lg px-4 py-2 text-sm"
            >
              My requests
            </AnimatedButton>
            <AnimatedButton
              href="/home"
              variant="primary"
              className="inline-flex rounded-lg px-4 py-2 text-sm"
            >
              Browse vocalists
            </AnimatedButton>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <ProjectGroup title="Active" orders={active} />
          )}
          {completed.length > 0 && (
            <ProjectGroup title="Completed" orders={completed} completed />
          )}
        </>
      )}
    </div>
  );
}

function ProjectGroup({
  title,
  orders,
  completed,
}: {
  title: string;
  orders: ProducerOrder[];
  completed?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-vox-label">{title}</h3>
      <div className="grid gap-3">
        {orders.map((order) => (
          <article
            key={order.id}
            className={`rounded-xl border p-4 ${
              completed
                ? "border-emerald-400/25 bg-emerald-500/5"
                : "border-white/10 bg-black/30"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-100">
                  {order.projectName || order.trackName}
                </p>
                <p className="mt-1 text-vox-meta">with {order.vocalistName}</p>
              </div>
              <span
                className={`text-[11px] font-medium uppercase tracking-wide ${
                  completed ? "text-emerald-300" : "text-purple-300"
                }`}
              >
                {completed ? "PROJECT COMPLETED" : orderStatusLabel[order.status]}
              </span>
            </div>
            <AnimatedButton
              href={`/workspace/${order.id}`}
              variant="secondary"
              className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-medium"
            >
              Open workspace
            </AnimatedButton>
          </article>
        ))}
      </div>
    </section>
  );
}
