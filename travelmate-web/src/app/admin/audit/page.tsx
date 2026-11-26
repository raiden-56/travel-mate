"use client";

import * as React from "react";
import { useAuditLogs } from "@/features/admin/hooks";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Pagination } from "@/components/common/pagination";
import { Skeleton } from "@/components/ui/misc";

export default function AuditLogPage() {
  const [page, setPage] = React.useState(0);
  const logs = useAuditLogs(page);
  return (
    <>
      <PageHeader title="Audit log" description="Sign-ins, admin actions and other security-relevant events. Append-only." />
      {logs.isLoading ? (
        <Skeleton className="h-96" />
      ) : logs.isError ? (
        <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
      ) : logs.data?.items.length === 0 ? (
        <EmptyState title="No events yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.data?.items.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-muted">{new Date(l.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-xs">{l.actorEmail ?? "system"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-muted">{l.targetType ? `${l.targetType} ${l.targetId?.slice(0, 8) ?? ""}` : "—"}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-xs text-ink-muted" title={l.details ?? undefined}>{l.details ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {logs.data && <Pagination page={logs.data.page} totalPages={logs.data.totalPages} onChange={setPage} />}
    </>
  );
}
