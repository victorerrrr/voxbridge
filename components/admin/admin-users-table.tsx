"use client";

import { useEffect, useState } from "react";
import {
  AdminActionButton,
  AdminTable,
  RoleBadge,
  StatusBadge,
} from "@/components/admin/admin-ui";
import {
  getAdminUsers,
  subscribeAdminStore,
  updateAdminUser,
  type AdminUserRecord,
} from "@/lib/admin";

type AdminUsersTableProps = {
  roleFilter?: AdminUserRecord["role"];
};

export function AdminUsersTable({ roleFilter }: AdminUsersTableProps) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sync = () => {
      getAdminUsers().then((list) => {
        setUsers(roleFilter ? list.filter((u) => u.role === roleFilter) : list);
      });
    };
    sync();
    return subscribeAdminStore(sync);
  }, [roleFilter]);

  const act = (id: string, label: string, patch: Partial<AdminUserRecord>) => {
    updateAdminUser(id, patch);
    setMessage(`${label} applied (localStorage).`);
  };

  return (
    <>
      {message && <p className="mb-3 text-sm text-emerald-300">{message}</p>}
      <AdminTable>
        <thead className="border-b border-white/10 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <p className="font-medium text-white">{user.username}</p>
                <p className="text-xs text-zinc-500">{user.email}</p>
              </td>
              <td className="px-4 py-3">
                <RoleBadge role={user.role} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={user.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <AdminActionButton
                    label="View"
                    onClick={() => setMessage(`Viewing ${user.username} (mock).`)}
                  />
                  <AdminActionButton
                    label="Block"
                    onClick={() => act(user.id, "Block", { status: "blocked" })}
                  />
                  <AdminActionButton
                    label="Verify"
                    onClick={() => act(user.id, "Verify", { status: "active" })}
                  />
                  <AdminActionButton
                    label="Delete"
                    variant="danger"
                    onClick={() => act(user.id, "Delete", { status: "blocked" })}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </>
  );
}
