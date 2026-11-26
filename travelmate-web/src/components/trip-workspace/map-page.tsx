"use client";

import * as React from "react";
import { useRouteId } from "@/lib/routes";
import { Layers, Route, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { useTrip } from "@/features/trips/hooks";
import { useDestination, useFavorites } from "@/features/destinations/hooks";
import { useAddItem, useItinerary, useReorderItinerary } from "@/features/itinerary/hooks";
import { useOptimizeRoute, useRoute } from "@/features/maps/hooks";
import { TravelMap, CATEGORY_COLORS, type MapMarker } from "@/components/maps/travel-map";
import { SourceLabel } from "@/components/common/labels";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api-client";
import { formatDuration } from "@/lib/dates";
import { cn, titleCase } from "@/lib/utils";
import type { AttractionDto, ItineraryItemDto } from "@/types/api";

function AttractionPopup({ a, dayCount, onAdd, pending }: { a: AttractionDto; dayCount: number; onAdd: (a: AttractionDto, day: number) => void; pending: boolean }) {
  const [day, setDay] = React.useState(1);
  return (
    <div className="w-52 space-y-2">
      <div>
        <p className="font-semibold">{a.name}</p>
        <p className="text-xs text-gray-600">{titleCase(a.category)} · {formatDuration(a.typicalDurationMinutes)}</p>
      </div>
      <div className="flex gap-1.5">
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} className="h-8 flex-1 rounded border border-gray-300 px-1 text-xs" aria-label="Day">
          {Array.from({ length: dayCount }, (_, i) => <option key={i} value={i + 1}>Day {i + 1}</option>)}
        </select>
        <button
          disabled={pending}
          onClick={() => onAdd(a, day)}
          className="h-8 rounded bg-[#283C32] px-2.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function TripMapPage() {
  const id = useRouteId();
  const trip = useTrip(id).data!;
  const itinerary = useItinerary(id);
  const destination = useDestination(trip.destination?.slug ?? "");
  const favorites = useFavorites();
  const addItem = useAddItem(id);
  const reorder = useReorderItinerary(id);
  const optimize = useOptimizeRoute();

  const [day, setDay] = React.useState<number | "all">(1);
  const [showPlaces, setShowPlaces] = React.useState(true);
  const [showSaved, setShowSaved] = React.useState(true);
  const [focus, setFocus] = React.useState<{ lat: number; lng: number } | null>(null);

  const days = React.useMemo(() => itinerary.data?.days ?? [], [itinerary.data]);
  const dayStops: ItineraryItemDto[] = React.useMemo(() => {
    const list = day === "all" ? days.flatMap((d) => d.items) : (days.find((d) => d.dayNumber === day)?.items ?? []);
    return list.filter((i) => i.latitude != null && i.longitude != null && i.status !== "CANCELLED" && i.status !== "SKIPPED");
  }, [days, day]);

  const routePoints = day === "all" ? [] : dayStops.map((s) => ({ lat: s.latitude!, lng: s.longitude! }));
  const route = useRoute(routePoints);

  const plannedAttractionIds = new Set(days.flatMap((d) => d.items.map((i) => i.attractionId)).filter(Boolean));
  const places = (destination.data?.attractions ?? []).filter((a) => !plannedAttractionIds.has(a.id));
  const saved = (favorites.data ?? []).flatMap((f) => (f.attraction && !plannedAttractionIds.has(f.attraction.id) ? [f.attraction] : []));

  const onAdd = (a: AttractionDto, dayNumber: number) =>
    addItem.mutate(
      {
        dayNumber,
        title: a.name,
        category: a.category === "RESTAURANT" || a.category === "CAFE" ? "RESTAURANT" : "ATTRACTION",
        locationName: a.name,
        latitude: a.latitude,
        longitude: a.longitude,
        durationMinutes: a.typicalDurationMinutes,
        estimatedCost: a.costMax === "0.00" ? null : a.costMax,
        attractionId: a.id,
      },
      { onSuccess: () => toast.success(`Added ${a.name} to Day ${dayNumber}`), onError: (e) => toast.error(errorMessage(e)) },
    );

  const runOptimize = () => {
    if (day === "all" || dayStops.length < 3) return;
    optimize.mutate(
      { points: routePoints, keepFirst: true, keepLast: false },
      {
        onSuccess: (res) => {
          const saved = res.distanceKmBefore - res.distanceKmAfter;
          if (saved < 0.5) {
            toast.info("This day's order is already about as short as it gets.");
            return;
          }
          const dayItems = days.find((d) => d.dayNumber === day)!.items;
          const optimizedMapped = res.order.map((i) => dayStops[i].id);
          // Unmapped / skipped items keep their relative position at the end.
          const rest = dayItems.filter((i) => !optimizedMapped.includes(i.id)).map((i) => i.id);
          reorder.mutate(
            days.map((d) => ({ dayNumber: d.dayNumber, itemIds: d.dayNumber === day ? [...optimizedMapped, ...rest] : d.items.map((i) => i.id) })),
            {
              onSuccess: () =>
                toast.success(`Reordered Day ${day}: about ${saved.toFixed(1)} km shorter${res.provenance.approximate ? " (straight-line estimate)" : ""}. Check times still work.`),
              onError: (e) => toast.error(errorMessage(e)),
            },
          );
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  if (itinerary.isLoading) return <Skeleton className="h-[70vh]" />;
  if (itinerary.isError) return <ErrorState error={itinerary.error} onRetry={() => itinerary.refetch()} />;

  const markers: MapMarker[] = [
    ...(showPlaces ? places : []).map((a) => ({
      id: `a-${a.id}`,
      lat: a.latitude,
      lng: a.longitude,
      title: a.name,
      color: "#B9B5A9",
      popup: <AttractionPopup a={a} dayCount={trip.dayCount} onAdd={onAdd} pending={addItem.isPending} />,
    })),
    ...(showSaved ? saved.filter((s) => !places.some((p) => p.id === s.id) || !showPlaces) : []).map((a) => ({
      id: `s-${a.id}`,
      lat: a.latitude,
      lng: a.longitude,
      title: `${a.name} (saved)`,
      color: "#C78165",
      badge: "♥",
      popup: <AttractionPopup a={a} dayCount={trip.dayCount} onAdd={onAdd} pending={addItem.isPending} />,
    })),
    ...dayStops.map((s, idx) => ({
      id: s.id,
      lat: s.latitude!,
      lng: s.longitude!,
      title: s.title,
      color: CATEGORY_COLORS[s.category] ?? "#283C32",
      badge: day === "all" ? `D${s.dayNumber}` : String(idx + 1),
      highlighted: true,
      popup: (
        <div className="w-52">
          <p className="font-semibold">{s.title}</p>
          <p className="text-xs text-gray-600">Day {s.dayNumber} · {titleCase(s.category)}{s.durationMinutes ? ` · ${formatDuration(s.durationMinutes)}` : ""}</p>
        </div>
      ),
    })),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="order-2 space-y-4 lg:order-1">
        <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-soft)]">
          <label htmlFor="day" className="text-[13px] font-medium">Showing</label>
          <Select id="day" className="mt-1.5" value={String(day)} onChange={(e) => setDay(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">All days</option>
            {days.map((d) => <option key={d.dayNumber} value={d.dayNumber}>Day {d.dayNumber}</option>)}
          </Select>

          {day !== "all" && (
            <div className="mt-4 space-y-3">
              {dayStops.length < 2 ? (
                <p className="text-[13px] text-ink-muted">Add at least two stops with a location to see the route for this day.</p>
              ) : route.isLoading ? (
                <Skeleton className="h-14" />
              ) : route.isError ? (
                <p className="text-[13px] text-danger">Route unavailable right now. <button onClick={() => route.refetch()} className="underline">Retry</button></p>
              ) : route.data ? (
                <>
                  <div className="flex items-center gap-3">
                    <Route className="size-5 text-sage" aria-hidden />
                    <div>
                      <p className="font-display text-lg font-semibold">
                        {route.data.distanceKm.toFixed(1)} km
                        {route.data.durationMinutes != null && <span className="text-ink-muted"> · {formatDuration(Math.round(route.data.durationMinutes))}</span>}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {route.data.durationMinutes == null ? "Straight-line distance; drive time unavailable" : "Driving, all stops in order"}
                      </p>
                    </div>
                  </div>
                  <SourceLabel provenance={route.data.provenance} />
                </>
              ) : null}
              <Button variant="secondary" size="sm" className="w-full" disabled={dayStops.length < 3} loading={optimize.isPending || reorder.isPending} onClick={runOptimize}>
                <Shuffle /> Optimize stop order
              </Button>
              {dayStops.length < 3 && <p className="text-xs text-ink-muted">Needs three or more mapped stops.</p>}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-soft)]">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium"><Layers className="size-4 text-sage" /> Layers</p>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={showPlaces} onChange={(e) => setShowPlaces(e.target.checked)} className="accent-[var(--sage)]" />
            <span className="size-2.5 rounded-full bg-[#B9B5A9]" aria-hidden /> Places to see ({places.length})
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={showSaved} onChange={(e) => setShowSaved(e.target.checked)} className="accent-[var(--sage)]" />
            <span className="size-2.5 rounded-full bg-terracotta" aria-hidden /> Saved places ({saved.length})
          </label>
          <p className="mt-2 text-xs text-ink-muted">Tap a grey or saved marker to add it to a day.</p>
        </div>

        {dayStops.length > 0 && (
          <ol className="space-y-1 rounded-lg bg-surface p-2 shadow-[var(--shadow-soft)]">
            {dayStops.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => setFocus({ lat: s.latitude!, lng: s.longitude! })}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-muted"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: CATEGORY_COLORS[s.category] ?? "#283C32" }}>
                    {day === "all" ? s.dayNumber : i + 1}
                  </span>
                  <span className="truncate">{s.title}</span>
                  {day !== "all" && route.data?.legs[i - 1] && i > 0 && (
                    <span className="ml-auto shrink-0 text-[11px] text-ink-muted">+{route.data.legs[i - 1].distanceKm.toFixed(1)} km</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        )}
      </aside>

      <div className={cn("order-1 h-[60vh] overflow-hidden rounded-lg border border-line lg:order-2 lg:h-[calc(100dvh-220px)]")}>
        <TravelMap
          markers={markers}
          route={route.data?.geometry}
          center={trip.destination ? { lat: trip.destination.latitude, lng: trip.destination.longitude } : undefined}
          fitKey={`${day}|${dayStops.map((s) => s.id).join(",")}|${showPlaces}|${showSaved}`}
          focus={focus}
        />
      </div>
    </div>
  );
}
