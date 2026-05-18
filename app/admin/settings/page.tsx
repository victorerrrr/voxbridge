"use client";

import { useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { AdminPageHeader } from "@/components/admin/admin-ui";

export default function AdminSettingsPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [notice, setNotice] = useState("");

  const save = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "voxbridge_admin_settings",
        JSON.stringify({ maintenance })
      );
    }
    setNotice("Settings saved to localStorage (demo only).");
  };

  return (
    <AdminPageShell activeItem="settings">
      <AdminPageHeader
        title="Admin Settings"
        description="Platform toggles for the MVP demo — no backend."
      />
      {notice && <p className="mb-4 text-sm text-emerald-300">{notice}</p>}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3">
        <input
          type="checkbox"
          checked={maintenance}
          onChange={(e) => setMaintenance(e.target.checked)}
          className="h-4 w-4 rounded border-white/20"
        />
        <span className="text-sm text-zinc-200">Maintenance mode (mock)</span>
      </label>
      <button
        type="button"
        onClick={save}
        className="mt-4 rounded-lg border border-amber-400/35 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/25"
      >
        Save settings
      </button>
    </AdminPageShell>
  );
}
