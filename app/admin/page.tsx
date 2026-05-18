"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatGrid,
} from "@/components/admin/admin-ui";
import {
  getAdminDashboardStats,
  subscribeAdminStore,
  type AdminDashboardStats,
} from "@/lib/admin";
import { subscribeProducerOrders } from "@/lib/orders";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    const sync = () => setStats(getAdminDashboardStats());
    sync();
    const unsubAdmin = subscribeAdminStore(sync);
    const unsubOrders = subscribeProducerOrders(sync);
    return () => {
      unsubAdmin();
      unsubOrders();
    };
  }, []);

  return (
    <AdminPageShell activeItem="overview">
      <AdminPageHeader
        title="Admin Overview"
        description="Platform snapshot from localStorage — orders, requests, users, and reports."
      />
      <AdminStatGrid>
        <AdminStatCard label="Total users" value={stats?.totalUsers ?? "—"} />
        <AdminStatCard label="Active orders" value={stats?.activeOrders ?? "—"} />
        <AdminStatCard label="Pending requests" value={stats?.pendingRequests ?? "—"} />
        <AdminStatCard label="Open workspaces" value={stats?.openWorkspaces ?? "—"} />
        <AdminStatCard label="Recent messages" value={stats?.recentMessages ?? "—"} hint="Conversations + reviews" />
        <AdminStatCard label="Open reports" value={stats?.openReports ?? "—"} />
      </AdminStatGrid>
      <p className="text-sm text-zinc-500">
        Use the sidebar to manage users, orders, workspaces, moderation, and settings. Preview producer or vocalist
        flows from the top bar without leaving admin auth.
      </p>
    </AdminPageShell>
  );
}
