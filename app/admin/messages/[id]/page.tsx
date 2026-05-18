"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminActionButton, AdminPageHeader } from "@/components/admin/admin-ui";
import { getAdminConversation, getAdminThreadMessages } from "@/lib/admin";

export default function AdminMessageThreadPage() {
  const params = useParams<{ id: string }>();
  const conversation = useMemo(
    () => getAdminConversation(params.id),
    [params.id]
  );
  const messages = useMemo(() => getAdminThreadMessages(params.id), [params.id]);
  const [notice, setNotice] = useState("");

  if (!conversation) {
    return (
      <AdminPageShell activeItem="messages">
        <p className="text-zinc-400">Conversation not found.</p>
        <Link href="/admin/messages" className="mt-4 inline-block text-amber-300">
          Back to messages
        </Link>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell activeItem="messages">
      <AdminPageHeader
        title={conversation.participants}
        description="Admin chat view — Flag, Hide, and Warn are mock actions stored in session only."
      />
      <Link href="/admin/messages" className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        ← All conversations
      </Link>
      {notice && <p className="mb-3 text-sm text-emerald-300">{notice}</p>}
      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3"
          >
            <p className="text-xs text-zinc-500">
              {msg.sender} · {new Date(msg.at).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-zinc-200">{msg.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <AdminActionButton label="Flag" onClick={() => setNotice("Thread flagged (mock).")} />
        <AdminActionButton label="Hide" onClick={() => setNotice("Message hidden (mock).")} />
        <AdminActionButton label="Warn" onClick={() => setNotice("Warning sent to user (mock).")} />
      </div>
    </AdminPageShell>
  );
}
