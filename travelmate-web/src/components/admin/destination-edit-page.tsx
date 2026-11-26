"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminDestination, useDeleteAttraction, useDestinationAction, useSaveDestination } from "@/features/admin/hooks";
import { DestinationForm } from "@/components/admin/destination-form";
import { AttractionDialog } from "@/components/admin/attraction-dialog";
import { ErrorState, PageHeader } from "@/components/common/states";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, Card, Skeleton } from "@/components/ui/misc";
import { useAuthStore, hasPermission } from "@/lib/auth-store";
import { errorMessage } from "@/lib/api-client";
import { formatDuration } from "@/lib/dates";
import { formatMoneyRange } from "@/lib/money";
import { titleCase } from "@/lib/utils";
import type { AttractionDto } from "@/types/api";
import { adminDestinationHref, useRouteId } from "@/lib/routes";

export default function AdminDestinationEditPage() {
  const id = useRouteId();
  const isNew = id === "new";
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const destination = useAdminDestination(isNew ? null : id);
  const save = useSaveDestination();
  const action = useDestinationAction();
  const delAttraction = useDeleteAttraction();
  const [dialog, setDialog] = React.useState<{ open: boolean; attraction: AttractionDto | null }>({ open: false, attraction: null });
  const [toDelete, setToDelete] = React.useState<AttractionDto | null>(null);

  if (!isNew && destination.isLoading) return <Skeleton className="h-[70vh]" />;
  if (!isNew && (destination.isError || !destination.data)) return <ErrorState error={destination.error} onRetry={() => destination.refetch()} />;
  const d = destination.data;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/destinations" className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink"><ChevronLeft className="size-4" /> Destinations</Link>
      <PageHeader
        title={isNew ? "New destination" : d!.name}
        eyebrow={d && <Badge tone={d.status === "PUBLISHED" ? "sage" : "amber"}>{d.status === "PUBLISHED" ? "Published" : "Draft"}</Badge>}
        actions={
          d && (
            <>
              {d.status === "PUBLISHED" && (
                <Button variant="secondary" size="sm" asChild><Link href={`/destinations/${d.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink /> View</Link></Button>
              )}
              {hasPermission(user, "destination:publish") && (
                <Button
                  size="sm"
                  variant={d.status === "PUBLISHED" ? "secondary" : "primary"}
                  loading={action.isPending}
                  onClick={() => action.mutate({ id: d.id, action: d.status === "PUBLISHED" ? "unpublish" : "publish" }, { onSuccess: () => toast.success(d.status === "PUBLISHED" ? "Unpublished" : "Published"), onError: (e) => toast.error(errorMessage(e)) })}
                >
                  {d.status === "PUBLISHED" ? <><EyeOff /> Unpublish</> : <><Eye /> Publish</>}
                </Button>
              )}
            </>
          )
        }
      />

      {d && (
        <Card className="mb-6 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Places ({d.attractions.length})</h2>
            <Button size="sm" variant="secondary" onClick={() => setDialog({ open: true, attraction: null })}><Plus /> Add place</Button>
          </div>
          {d.attractions.length === 0 ? (
            <p className="text-sm text-ink-muted">No places yet. The planner needs places to build itineraries for this destination.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.attractions.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-ink-muted">{titleCase(a.category)} · {formatDuration(a.typicalDurationMinutes)} · {formatMoneyRange(a.costMin, a.costMax, a.currency)}</p>
                  </div>
                  <Button size="icon-sm" variant="ghost" onClick={() => setDialog({ open: true, attraction: a })} aria-label={`Edit ${a.name}`}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setToDelete(a)} aria-label={`Delete ${a.name}`} className="hover:text-danger"><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <DestinationForm
        key={d?.updatedAt ?? "new"}
        destination={d}
        pending={save.isPending}
        serverError={save.error}
        onSubmit={(body) =>
          save.mutate(
            { id: d?.id, body },
            {
              onSuccess: (saved) => {
                toast.success(isNew ? "Draft created — add places, then publish" : "Saved");
                if (isNew) router.replace(adminDestinationHref(saved.id));
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      />

      {d && <AttractionDialog destinationId={d.id} attraction={dialog.attraction} open={dialog.open} onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} />}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="It will disappear from the destination page, maps and future plans. Existing itinerary items keep their copy."
        confirmLabel="Delete place"
        destructive
        loading={delAttraction.isPending}
        onConfirm={() => toDelete && delAttraction.mutate(toDelete.id, { onSuccess: () => { toast.success("Place deleted"); setToDelete(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  );
}
