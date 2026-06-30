"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminPageHeader, AdminTable, StatusBadge } from "@/components/admin/admin-ui";
import { getProducerOrders, subscribeProducerOrders, type ProducerOrder } from "@/lib/orders";

export default function AdminWorkspacesPage() {
  const [orders, setOrders] = useState<ProducerOrder[]>([]);

  useEffect(() => {
    const sync = () => {
      getProducerOrders().then((list) => {
        setOrders(list.filter((o) => o.status !== "completed"));
      });
    };
    sync();
    return subscribeProducerOrders(sync);
  }, []);

  return (
    <AdminPageShell activeItem="workspaces">
      <AdminPageHeader
        title="Workspaces"
        description="Active collaboration rooms. Opens in admin view mode without affecting producer/vocalist flows."
      />
      <AdminTable>
        <thead className="border-b border-white/10 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Workspace</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Parties</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                No open workspaces.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{order.projectName ?? order.trackName}</p>
                  <p className="text-xs text-zinc-500">{order.id}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-sm text-zinc-400">
                  {order.producerName ?? "Producer"} → {order.vocalistName}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/workspace/${order.id}?admin=1`}
                    className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
                  >
                    Open admin view
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
