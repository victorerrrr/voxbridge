"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminPageHeader, AdminTable, StatusBadge } from "@/components/admin/admin-ui";
import {
  getAdminConversations,
  subscribeAdminStore,
  type AdminConversation,
} from "@/lib/admin";

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);

  useEffect(() => {
    const sync = () => setConversations(getAdminConversations());
    sync();
    return subscribeAdminStore(sync);
  }, []);

  return (
    <AdminPageShell activeItem="messages">
      <AdminPageHeader title="Messages" description="Mock conversation list with moderation actions in thread view." />
      <AdminTable>
        <thead className="border-b border-white/10 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Participants</th>
            <th className="px-4 py-3">Last message</th>
            <th className="px-4 py-3">Flagged</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {conversations.map((conv) => (
            <tr key={conv.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-medium text-white">{conv.participants}</td>
              <td className="max-w-md truncate px-4 py-3 text-zinc-400">{conv.lastMessage}</td>
              <td className="px-4 py-3">
                <StatusBadge status={conv.flagged ? "open" : "resolved"} />
                {conv.flagged ? " Yes" : " No"}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/messages/${conv.id}`}
                  className="text-sm text-amber-300 hover:text-amber-200"
                >
                  Open chat
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
