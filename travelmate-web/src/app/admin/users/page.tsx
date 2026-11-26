"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAdminUsers, useUserAction } from "@/features/admin/hooks";
import { useDebounced } from "@/hooks/use-debounced";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Pagination } from "@/components/common/pagination";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { useAuthStore, hasPermission } from "@/lib/auth-store";
import { errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { titleCase } from "@/lib/utils";
import type { AdminUserRow } from "@/types/api";

export default function AdminUsersPage() {
  const me = useAuthStore((s) => s.user);
  const canManage = hasPermission(me, "user:manage");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(0);
  const debounced = useDebounced(q, 300);
  const users = useAdminUsers({ q: debounced || undefined, status: status || undefined, page });
  const action = useUserAction();
  const [target, setTarget] = React.useState<{ user: AdminUserRow; action: "suspend" | "reactivate" } | null>(null);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => setPage(0), [debounced, status]);

  return (
    <>
      <PageHeader title="Users" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" aria-label="Search users" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40" aria-label="Status">
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>
      {users.isLoading ? (
        <Skeleton className="h-96" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : users.data?.items.length === 0 ? (
        <EmptyState title="No users match" />
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Trips</th>
                <th className="px-4 py-3 font-medium">Last sign-in</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.data?.items.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.displayName}</p>
                    <p className="text-xs text-ink-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{u.roles.map(titleCase).join(", ")}</td>
                  <td className="px-4 py-3"><Badge tone={u.status === "ACTIVE" ? "sage" : "terracotta"}>{titleCase(u.status)}</Badge></td>
                  <td className="px-4 py-3 tabular-nums">{u.tripCount}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage && u.id !== me?.id && (
                      u.status === "ACTIVE" ? (
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => { setReason(""); setTarget({ user: u, action: "suspend" }); }}>Suspend</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => { setReason(""); setTarget({ user: u, action: "reactivate" }); }}>Reactivate</Button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {users.data && <Pagination page={users.data.page} totalPages={users.data.totalPages} onChange={setPage} />}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent
          title={target?.action === "suspend" ? `Suspend ${target.user.displayName}?` : `Reactivate ${target?.user.displayName}?`}
          description={target?.action === "suspend" ? "They'll be signed out and can't sign in until reactivated." : "They'll be able to sign in again."}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!target || reason.trim().length < 3) return;
              action.mutate(
                { id: target.user.id, action: target.action, reason: reason.trim() },
                { onSuccess: () => { toast.success(target.action === "suspend" ? "User suspended" : "User reactivated"); setTarget(null); }, onError: (err) => toast.error(errorMessage(err)) },
              );
            }}
          >
            <Field label="Reason" htmlFor="reason" hint="Recorded in the audit log.">
              <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required minLength={3} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
              <Button type="submit" variant={target?.action === "suspend" ? "danger" : "primary"} loading={action.isPending} disabled={reason.trim().length < 3}>
                {target?.action === "suspend" ? "Suspend user" : "Reactivate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
