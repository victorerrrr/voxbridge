"use client";

import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AdminUsersTable } from "@/components/admin/admin-users-table";

export default function AdminUsersPage() {
  return (
    <AdminPageShell activeItem="users">
      <AdminPageHeader title="Users" description="Mock accounts plus any registered demo user from auth state." />
      <AdminUsersTable />
    </AdminPageShell>
  );
}
