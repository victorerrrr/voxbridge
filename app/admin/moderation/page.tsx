"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import {
  AdminActionButton,
  AdminPageHeader,
  AdminTable,
  StatusBadge,
} from "@/components/admin/admin-ui";
import {
  getModerationQueue,
  subscribeAdminStore,
  updateModerationItem,
  type ModerationItem,
} from "@/lib/admin";

export default function AdminModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(getModerationQueue());
    sync();
    return subscribeAdminStore(sync);
  }, []);

  return (
    <AdminPageShell activeItem="moderation">
      <AdminPageHeader
        title="Content Moderation"
        description="Demos, profiles, external links, and reports — approve or reject (localStorage)."
      />
      <AdminTable>
        <thead className="border-b border-white/10 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Kind</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 capitalize text-zinc-400">{item.kind}</td>
              <td className="px-4 py-3 text-white">{item.title}</td>
              <td className="px-4 py-3 text-zinc-400">{item.owner}</td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3">
                {item.status === "pending" ? (
                  <div className="flex gap-1.5">
                    <AdminActionButton
                      label="Approve"
                      onClick={() => updateModerationItem(item.id, "approved")}
                    />
                    <AdminActionButton
                      label="Reject"
                      variant="danger"
                      onClick={() => updateModerationItem(item.id, "rejected")}
                    />
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">Reviewed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
