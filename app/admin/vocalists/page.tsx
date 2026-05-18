"use client";

import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AdminUsersTable } from "@/components/admin/admin-users-table";

export default function AdminVocalistsPage() {
  return (
    <AdminPageShell activeItem="vocalists">
      <AdminPageHeader title="Vocalists" description="Vocalist accounts filtered from the user registry." />
      <AdminUsersTable roleFilter="vocalist" />
    </AdminPageShell>
  );
}
