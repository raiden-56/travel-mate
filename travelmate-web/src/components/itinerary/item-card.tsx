"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckCircle2,
  Copy,
  GripVertical,
  Lock,
  MapPin,
  MoreVertical,
  Navigation,
  Pencil,
  SkipForward,
  Trash2,
  Unlock,
  Wallet,
} from "lucide-react";
import type { ItineraryItemDto } from "@/types/api";
import { CATEGORY_COLORS } from "@/components/maps/types";
import { ItemStatusChip } from "@/components/common/labels";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { formatDuration, formatTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn, titleCase } from "@/lib/utils";

export type ItemActions = {
  onEdit: (item: ItineraryItemDto) => void;
  onDuplicate: (item: ItineraryItemDto) => void;
  onDelete: (item: ItineraryItemDto) => void;
  onPatch: (item: ItineraryItemDto, patch: Partial<ItineraryItemDto>) => void;
};

export function directionsUrl(item: Pick<ItineraryItemDto, "latitude" | "longitude">): string | null {
  if (item.latitude == null || item.longitude == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
}

export function ItemCardBody({
  item,
  actions,
  warned,
  dragHandle,
  readOnly,
}: {
  item: ItineraryItemDto;
  actions?: ItemActions;
  warned?: boolean;
  dragHandle?: React.ReactNode;
  readOnly?: boolean;
}) {
  const color = CATEGORY_COLORS[item.category] ?? "#58745B";
  const dir = directionsUrl(item);
  const muted = item.status === "SKIPPED" || item.status === "CANCELLED";
  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-lg border bg-surface p-3 pr-2 transition-shadow",
        warned ? "border-amber" : "border-line",
        muted && "opacity-60",
      )}
    >
      {dragHandle}
      <div className="w-12 shrink-0 pt-0.5 text-right text-xs tabular-nums leading-5 text-ink-muted">
        {item.startTime ? (
          <>
            <span className="block font-medium text-ink">{formatTime(item.startTime)}</span>
            {item.endTime && <span className="block">{formatTime(item.endTime)}</span>}
          </>
        ) : (
          <span>—</span>
        )}
      </div>
      <span className="mt-1.5 h-[calc(100%-12px)] w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={cn("font-medium leading-5", item.status === "COMPLETED" && "line-through decoration-ink-muted/50")}>
            {item.title}
          </p>
          {item.locked && <Lock className="size-3.5 text-sage" aria-label="Kept by you" />}
          {item.status !== "PLANNED" && <ItemStatusChip status={item.status} />}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-muted">
          <span>{titleCase(item.category)}</span>
          {item.locationName && item.locationName !== item.title && (
            <span className="flex items-center gap-1"><MapPin className="size-3" aria-hidden />{item.locationName}</span>
          )}
          {item.durationMinutes != null && <span>{formatDuration(item.durationMinutes)}</span>}
          {item.estimatedCost && (
            <span className="flex items-center gap-1" title={item.costIsEstimate ? "Estimate" : undefined}>
              <Wallet className="size-3" aria-hidden />
              {item.costIsEstimate && "~"}
              {formatMoney(item.estimatedCost, item.currency, { noDecimals: true })}
            </span>
          )}
          {item.bookingReference && <span>Ref {item.bookingReference}</span>}
        </p>
        {item.aiReason && <p className="mt-1 text-[12.5px] italic text-ink-muted">{item.aiReason}</p>}
        {item.notes && <p className="mt-1 whitespace-pre-line text-[12.5px] text-ink/80">{item.notes}</p>}
      </div>
      {!readOnly && actions && (
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="self-start rounded-md p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink" aria-label={`Actions for ${item.title}`}>
              <MoreVertical className="size-4" />
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem onSelect={() => actions.onEdit(item)}><Pencil /> Edit</DropdownItem>
            {item.status !== "COMPLETED" && (
              <DropdownItem onSelect={() => actions.onPatch(item, { status: "COMPLETED" })}><CheckCircle2 /> Mark done</DropdownItem>
            )}
            {item.status === "PLANNED" && (
              <DropdownItem onSelect={() => actions.onPatch(item, { status: "SKIPPED" })}><SkipForward /> Skip</DropdownItem>
            )}
            {item.status !== "PLANNED" && (
              <DropdownItem onSelect={() => actions.onPatch(item, { status: "PLANNED" })}><SkipForward /> Back to planned</DropdownItem>
            )}
            <DropdownItem onSelect={() => actions.onPatch(item, { locked: !item.locked })}>
              {item.locked ? <Unlock /> : <Lock />} {item.locked ? "Let planner change it" : "Keep this activity"}
            </DropdownItem>
            {dir && (
              <DropdownItem asChild>
                <a href={dir} target="_blank" rel="noopener noreferrer"><Navigation /> Directions</a>
              </DropdownItem>
            )}
            <DropdownItem onSelect={() => actions.onDuplicate(item)}><Copy /> Duplicate</DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive onSelect={() => actions.onDelete(item)}><Trash2 /> Delete</DropdownItem>
          </DropdownContent>
        </Dropdown>
      )}
    </div>
  );
}

export function SortableItem({ item, actions, warned }: { item: ItineraryItemDto; actions: ItemActions; warned: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { dayNumber: item.dayNumber } });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "z-10 opacity-40")}
    >
      <ItemCardBody
        item={item}
        actions={actions}
        warned={warned}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            className="-ml-1 cursor-grab touch-none self-stretch rounded px-0.5 text-ink-muted/60 hover:text-ink active:cursor-grabbing"
            aria-label={`Drag to reorder ${item.title}`}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  );
}
