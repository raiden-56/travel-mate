"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminDestinations, useDestinationAction } from "@/features/admin/hooks";
import { useDebounced } from "@/hooks/use-debounced";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Pagination } from "@/components/common/pagination";
import { SeedBadge } from "@/components/common/labels";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { useAuthStore, hasPermission } from "@/lib/auth-store";
import { errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import type { AdminDestinationRow } from "@/types/api";
import { adminDestinationHref } from "@/lib/routes";

function DestinationsTable() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const canPublish = hasPermission(user, "destination:publish");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState(params.get("status") ?? "");
  const [page, setPage] = React.useState(0);
  const debounced = useDebounced(q, 300);
  const list = useAdminDestinations({ q: debounced || undefined, status: status || undefined, page });
  const action = useDestinationAction();
  const [toDelete, setToDelete] = React.useState<AdminDestinationRow | null>(null);

  React.useEffect(() => setPage(0), [debounced, status]);

  const run = (id: string, a: "publish" | "unpublish") =>
    action.mutate({ id, action: a }, { onSuccess: () => toast.success(a === "publish" ? "Published" : "Unpublished"), onError: (e) => toast.error(errorMessage(e)) });

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search by name or region" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" aria-label="Search destinations" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44" aria-label="Status">
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </Select>
      </div>
      {list.isLoading ? (
        <Skeleton className="h-96" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data?.items.length === 0 ? (
        <EmptyState title="No destinations found" action={<Button onClick={() => router.push(adminDestinationHref("new"))}><Plus /> New destination</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Categories</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data?.items.map((d) => (
                <tr key={d.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <Link href={adminDestinationHref(d.id)} className="font-medium hover:text-sage">{d.name}</Link>
                    <p className="text-xs text-ink-muted">{d.region}, {d.state} {d.featured && "· Featured"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={d.status === "PUBLISHED" ? "sage" : "amber"}>{d.status === "PUBLISHED" ? "Published" : "Draft"}</Badge>
                      {d.seedData && <SeedBadge />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{d.categories.map((c) => c.name).join(", ")}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{formatDate(d.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canPublish && (
                        d.status === "PUBLISHED" ? (
                          <Button size="icon-sm" variant="ghost" onClick={() => run(d.id, "unpublish")} aria-label={`Unpublish ${d.name}`} title="Unpublish"><EyeOff /></Button>
                        ) : (
                          <Button size="icon-sm" variant="ghost" onClick={() => run(d.id, "publish")} aria-label={`Publish ${d.name}`} title="Publish"><Eye /></Button>
                        )
                      )}
                      <Button size="icon-sm" variant="ghost" asChild><Link href={adminDestinationHref(d.id)} aria-label={`Edit ${d.name}`}><Pencil /></Link></Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => setToDelete(d)} aria-label={`Delete ${d.name}`} className="hover:text-danger"><Trash2 /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="It will be removed from the public site and search. Existing trips keep their copy of the destination name."
        confirmLabel="Delete destination"
        destructive
        loading={action.isPending}
        onConfirm={() => toDelete && action.mutate({ id: toDelete.id, action: "delete" }, { onSuccess: () => { toast.success("Destination deleted"); setToDelete(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </>
  );
}

export default function AdminDestinationsPage() {
  return (
    <>
      <PageHeader title="Destinations" actions={<Button asChild><Link href={adminDestinationHref("new")}><Plus /> New destination</Link></Button>} />
      <Suspense>
        <DestinationsTable />
      </Suspense>
    </>
  );
}
