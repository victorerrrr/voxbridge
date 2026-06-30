"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminPageHeader, AdminTable, StatusBadge } from "@/components/admin/admin-ui";
import {
  getProducerOrders,
  orderStatusLabel,
  subscribeProducerOrders,
  type ProducerOrder,
} from "@/lib/orders";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<ProducerOrder[]>([]);

  useEffect(() => {
    const sync = () => {
      getProducerOrders().then(setOrders);
    };
    sync();
    return subscribeProducerOrders(sync);
  }, []);

  return (
    <AdminPageShell activeItem="orders">
      <AdminPageHeader
        title="Orders"
        description="All producer orders from voxbridge_producer_orders in localStorage."
      />
      <AdminTable>
        <thead className="border-b border-white/10 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Producer</th>
            <th className="px-4 py-3">Vocalist</th>
            <th className="px-4 py-3">Workspace</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                No orders yet. Create one as a producer in preview mode.
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
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {orderStatusLabel[order.status] ?? order.status}
                  </p>
                </td>
                <td className="px-4 py-3 text-zinc-300">{order.producerName ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-300">{order.vocalistName}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/workspace/${order.id}?admin=1`}
                    className="text-sm text-amber-300 hover:text-amber-200"
                  >
                    Open workspace
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
