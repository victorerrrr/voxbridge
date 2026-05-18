"use client";

import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AdminUsersTable } from "@/components/admin/admin-users-table";

export default function AdminProducersPage() {
  return (
    <AdminPageShell activeItem="producers">
      <AdminPageHeader title="Producers" description="Producer accounts filtered from the user registry." />
      <AdminUsersTable roleFilter="producer" />
    </AdminPageShell>
  );
}
