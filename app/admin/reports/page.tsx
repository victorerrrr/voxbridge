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
  getAdminReports,
  subscribeAdminStore,
  updateAdminReport,
  type AdminReport,
} from "@/lib/admin";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);

  useEffect(() => {
    const sync = () => setReports(getAdminReports());
    sync();
    return subscribeAdminStore(sync);
  }, []);

  return (
    <AdminPageShell activeItem="reports">
      <AdminPageHeader title="Reports" description="User and content reports with resolve actions." />
      <AdminTable>
        <thead className="border-b border-white/10 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {reports.map((report) => (
            <tr key={report.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 capitalize text-zinc-300">{report.type}</td>
              <td className="px-4 py-3 text-white">{report.subject}</td>
              <td className="px-4 py-3">
                <StatusBadge status={report.status} />
              </td>
              <td className="px-4 py-3">
                {report.status === "open" ? (
                  <AdminActionButton
                    label="Resolve"
                    onClick={() => updateAdminReport(report.id, "resolved")}
                  />
                ) : (
                  <span className="text-xs text-zinc-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPageShell>
  );
}
