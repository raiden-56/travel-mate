"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarRange, LayoutList, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTrip } from "@/features/trips/hooks";
import { useDestination } from "@/features/destinations/hooks";
import { useDeleteItem, useDuplicateItem, useItinerary, useUpdateItem } from "@/features/itinerary/hooks";
import { ItineraryBoard } from "@/components/itinerary/itinerary-board";
import { ItemDialog } from "@/components/itinerary/item-dialog";
import { ModifyPanel } from "@/components/itinerary/modify-panel";
import { WarningsPanel } from "@/components/itinerary/warnings-panel";
import { ItemCardBody, type ItemActions } from "@/components/itinerary/item-card";
import { TravelMap, CATEGORY_COLORS } from "@/components/maps/travel-map";
import { EmptyState, ErrorState } from "@/components/common/states";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { EstimateBadge } from "@/components/common/labels";
import { errorMessage, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ItineraryItemDto } from "@/types/api";

type View = "days" | "overview";

export default function ItineraryPage() {
  const { id } = useParams<{ id: string }>();
  const trip = useTrip(id).data!;
  const itinerary = useItinerary(id);
  const destination = useDestination(trip.destination?.slug ?? "");
  const update = useUpdateItem(id);
  const duplicate = useDuplicateItem(id);
  const del = useDeleteItem(id);

  const [view, setView] = React.useState<View>("days");
  const [dialog, setDialog] = React.useState<{ open: boolean; item: ItineraryItemDto | null; day: number }>({ open: false, item: null, day: 1 });
  const [toDelete, setToDelete] = React.useState<ItineraryItemDto | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<number | null>(1);

  const actions: ItemActions = {
    onEdit: (item) => setDialog({ open: true, item, day: item.dayNumber }),
    onDuplicate: (item) =>
      duplicate.mutate(item.id, { onSuccess: () => toast.success("Activity duplicated"), onError: (e) => toast.error(errorMessage(e)) }),
    onDelete: (item) => setToDelete(item),
    onPatch: (item, patch) =>
      update.mutate(
        { id: item.id, ...patch, version: item.version },
        {
          onError: (e) =>
            toast.error(e instanceof ApiError && e.code === "CONFLICT" ? "This activity changed elsewhere. Showing the latest version." : errorMessage(e)),
        },
      ),
  };

  if (itinerary.isLoading)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  if (itinerary.isError || !itinerary.data) return <ErrorState error={itinerary.error} onRetry={() => itinerary.refetch()} />;

  const it = itinerary.data;
  const total = it.days.reduce((n, d) => n + d.items.length, 0);
  const warnedIds = new Set(it.warnings.flatMap((w) => (w.severity === "WARNING" ? w.itemIds : [])));
  const mapDay = it.days.find((d) => d.dayNumber === selectedDay) ?? it.days[0];
  const mapItems = (mapDay?.items ?? []).filter((i) => i.latitude != null && i.longitude != null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Itinerary</h2>
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              {it.dayCount} days · {total} activities · ~{formatMoney(it.estimatedTotal, it.currency, { noDecimals: true })} <EstimateBadge />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Itinerary view" className="inline-flex rounded-lg bg-surface-muted p-1">
              {([
                ["days", "Days", LayoutList],
                ["overview", "Overview", CalendarRange],
              ] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium", view === v ? "bg-surface shadow-[var(--shadow-soft)]" : "text-ink-muted")}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => setDialog({ open: true, item: null, day: selectedDay ?? 1 })}>
              <Plus /> Add
            </Button>
          </div>
        </div>

        <WarningsPanel warnings={it.warnings} />

        {total === 0 ? (
          <EmptyState
            icon={<Sparkles />}
            title="Your days are wide open"
            description="Add activities one by one, or let the planner draft a full plan you can edit."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setDialog({ open: true, item: null, day: 1 })}><Plus /> Add activity</Button>
                <Button variant="subtle" asChild>
                  <Link href={`/planner?tripId=${id}${trip.destination ? `&destination=${trip.destination.slug}` : ""}`}><Sparkles /> Draft with planner</Link>
                </Button>
              </div>
            }
          />
        ) : null}

        {total > 0 && <ModifyPanel tripId={id} />}

        {view === "days" ? (
          <ItineraryBoard
            tripId={id}
            itinerary={it}
            actions={actions}
            warnedIds={warnedIds}
            onAdd={(day) => setDialog({ open: true, item: null, day })}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {it.days.map((d) => (
              <button
                key={d.dayNumber}
                onClick={() => {
                  setSelectedDay(d.dayNumber);
                  setView("days");
                  requestAnimationFrame(() => document.getElementById(`day-${d.dayNumber}`)?.scrollIntoView({ behavior: "smooth" }));
                }}
                className="rounded-lg bg-surface p-4 text-left shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lift)]"
              >
                <p className="font-display font-semibold">Day {d.dayNumber}</p>
                <p className="text-xs text-ink-muted">{d.date ? formatDate(d.date, { weekday: "long", year: undefined }) : "Date not set"}</p>
                <ul className="mt-3 space-y-1.5">
                  {d.items.slice(0, 6).map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-[13px]">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[i.category] }} aria-hidden />
                      <span className="truncate">{i.title}</span>
                    </li>
                  ))}
                  {d.items.length === 0 && <li className="text-[13px] text-ink-muted">Free day</li>}
                  {d.items.length > 6 && <li className="text-xs text-ink-muted">+{d.items.length - 6} more</li>}
                </ul>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-32 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Day {mapDay?.dayNumber} on the map</p>
            <Link href={`/trips/${id}/map`} className="text-[13px] text-sage hover:underline">Full map</Link>
          </div>
          <div className="h-[420px] overflow-hidden rounded-lg border border-line">
            {mapItems.length > 0 ? (
              <TravelMap
                markers={mapItems.map((i, idx) => ({
                  id: i.id,
                  lat: i.latitude!,
                  lng: i.longitude!,
                  title: i.title,
                  color: CATEGORY_COLORS[i.category] ?? "#58745B",
                  badge: String(idx + 1),
                  popup: <ItemCardBody item={i} readOnly />,
                }))}
              />
            ) : (
              <div className="grid size-full place-items-center bg-surface-muted p-6 text-center text-sm text-ink-muted">
                No mapped stops on this day yet. Add a location to see it here.
              </div>
            )}
          </div>
        </div>
      </aside>

      <ItemDialog
        tripId={id}
        dayCount={it.dayCount}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        item={dialog.item}
        defaultDay={dialog.day}
        attractions={destination.data?.attractions}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this activity?"
        description={`“${toDelete?.title}” will be removed from Day ${toDelete?.dayNumber}.`}
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          toDelete &&
          del.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success("Activity deleted");
              setToDelete(null);
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  );
}
