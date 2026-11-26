"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ItineraryDay, ItineraryDto, ItineraryItemDto } from "@/types/api";
import { useReorderItinerary } from "@/features/itinerary/hooks";
import { errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ItemCardBody, SortableItem, type ItemActions } from "./item-card";

type Columns = Record<number, string[]>;

function toColumns(days: ItineraryDay[]): Columns {
  return Object.fromEntries(days.map((d) => [d.dayNumber, d.items.map((i) => i.id)]));
}

function DayDropZone({ dayNumber, empty, children }: { dayNumber: number; empty: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayNumber}` });
  return (
    <ol
      ref={setNodeRef}
      className={cn(
        "min-h-14 space-y-2 rounded-lg transition-colors",
        empty && "grid place-items-center border border-dashed border-line",
        isOver && empty && "border-sage bg-sage-soft/40",
      )}
    >
      {children}
    </ol>
  );
}

type Props = {
  tripId: string;
  itinerary: ItineraryDto;
  actions: ItemActions;
  onAdd: (dayNumber: number) => void;
  warnedIds: Set<string>;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
};

export function ItineraryBoard({ tripId, itinerary, actions, onAdd, warnedIds, selectedDay, onSelectDay }: Props) {
  const reorder = useReorderItinerary(tripId);
  const [columns, setColumns] = React.useState<Columns>(() => toColumns(itinerary.days));
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const snapshot = React.useRef<Columns | null>(null);

  // Re-sync from the server unless a drag is in progress.
  React.useEffect(() => {
    if (!activeId) setColumns(toColumns(itinerary.days));
  }, [itinerary, activeId]);

  const byId = React.useMemo(
    () => new Map(itinerary.days.flatMap((d) => d.items).map((i) => [i.id, i] as const)),
    [itinerary],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findDay = (id: string, cols: Columns): number | null => {
    if (id.startsWith("day-")) return Number(id.slice(4));
    for (const [day, ids] of Object.entries(cols)) if (ids.includes(id)) return Number(day);
    return null;
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    snapshot.current = columns;
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    setColumns((cols) => {
      const from = findDay(activeKey, cols);
      const to = findDay(overKey, cols);
      if (from == null || to == null || from === to) return cols;
      const target = cols[to];
      const overIndex = overKey.startsWith("day-") ? target.length : Math.max(target.indexOf(overKey), 0);
      return {
        ...cols,
        [from]: cols[from].filter((x) => x !== activeKey),
        [to]: [...target.slice(0, overIndex), activeKey, ...target.slice(overIndex)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const activeKey = String(active.id);
    let next = columns;
    if (over) {
      const day = findDay(activeKey, columns);
      const overDay = findDay(String(over.id), columns);
      if (day != null && day === overDay && !String(over.id).startsWith("day-")) {
        const ids = columns[day];
        const oldIndex = ids.indexOf(activeKey);
        const newIndex = ids.indexOf(String(over.id));
        if (oldIndex !== newIndex) next = { ...columns, [day]: arrayMove(ids, oldIndex, newIndex) };
      }
    }
    setActiveId(null);
    const before = snapshot.current;
    snapshot.current = null;
    if (!over || JSON.stringify(before) === JSON.stringify(next)) {
      if (before) setColumns(before);
      return;
    }
    setColumns(next);
    reorder.mutate(
      Object.entries(next).map(([dayNumber, itemIds]) => ({ dayNumber: Number(dayNumber), itemIds })),
      { onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  const activeItem = activeId ? byId.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        if (snapshot.current) setColumns(snapshot.current);
        setActiveId(null);
      }}
    >
      <div className="space-y-8">
        {itinerary.days.map((day) => {
          const ids = columns[day.dayNumber] ?? [];
          return (
            <section key={day.dayNumber} id={`day-${day.dayNumber}`} className="scroll-mt-32" aria-label={`Day ${day.dayNumber}`}>
              <header className="mb-3 flex items-center justify-between gap-3">
                <button onClick={() => onSelectDay(day.dayNumber)} className="text-left" aria-pressed={selectedDay === day.dayNumber}>
                  <h3 className={cn("font-display text-[17px] font-semibold", selectedDay === day.dayNumber && "text-sage")}>
                    Day {day.dayNumber}
                    {day.date && (
                      <span className="ml-2 font-sans text-sm font-normal text-ink-muted">
                        {formatDate(day.date, { weekday: "short", year: undefined })}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {day.items.length} {day.items.length === 1 ? "activity" : "activities"}
                    {day.estimatedCost !== "0.00" && <> · ~{formatMoney(day.estimatedCost, itinerary.currency, { noDecimals: true })}</>}
                  </p>
                </button>
                <button
                  onClick={() => onAdd(day.dayNumber)}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-medium text-sage hover:bg-sage-soft"
                >
                  <Plus className="size-4" /> Add
                </button>
              </header>
              <SortableContext id={`day-${day.dayNumber}`} items={ids} strategy={verticalListSortingStrategy}>
                <DayDropZone dayNumber={day.dayNumber} empty={ids.length === 0}>
                  {ids.length === 0 ? (
                    <li className="py-3 text-[13px] text-ink-muted">Free day — drop an activity here or add one.</li>
                  ) : (
                    ids.map((id) => {
                      const item = byId.get(id);
                      return item ? <SortableItem key={id} item={item} actions={actions} warned={warnedIds.has(id)} /> : null;
                    })
                  )}
                </DayDropZone>
              </SortableContext>
            </section>
          );
        })}
      </div>
      <DragOverlay>{activeItem ? <ItemCardBody item={activeItem as ItineraryItemDto} readOnly /> : null}</DragOverlay>
    </DndContext>
  );
}
