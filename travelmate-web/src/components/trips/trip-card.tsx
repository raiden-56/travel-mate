import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import type { TripDto } from "@/types/api";
import { daysUntil, formatDateRange } from "@/lib/dates";
import { TripStatusChip } from "@/components/common/labels";
import { Skeleton } from "@/components/ui/misc";
import { tripHref } from "@/lib/routes";

export function tripCover(trip: TripDto): string | null {
  return trip.coverImageUrl ?? trip.destination?.heroImageUrl ?? null;
}

export function countdownLabel(trip: TripDto): string | null {
  if (!trip.startDate || trip.status === "COMPLETED" || trip.status === "CANCELLED") return null;
  const d = daysUntil(trip.startDate);
  if (d > 1) return `In ${d} days`;
  if (d === 1) return "Tomorrow";
  if (d === 0) return "Today";
  if (trip.endDate && daysUntil(trip.endDate) >= 0) return "Happening now";
  return null;
}

export function TripCard({ trip }: { trip: TripDto }) {
  const cover = tripCover(trip);
  const countdown = countdownLabel(trip);
  return (
    <Link
      href={tripHref(trip.id)}
      className="group flex overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)] sm:flex-col"
    >
      <div className="relative aspect-square w-28 shrink-0 bg-surface-muted sm:aspect-[16/9] sm:w-full">
        {cover ? (
          <Image src={cover} alt="" fill sizes="(min-width: 640px) 33vw, 112px" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : (
          <div className="size-full bg-gradient-to-br from-sage to-forest" />
        )}
        {countdown && (
          <span className="absolute left-2 top-2 hidden rounded-full bg-white/90 px-2.5 py-0.5 text-[11.5px] font-medium text-ink sm:block">
            {countdown}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display text-[15.5px] font-semibold group-hover:text-sage">{trip.name}</h3>
          <TripStatusChip status={trip.status} />
        </div>
        <p className="truncate text-[13px] text-ink-muted">{trip.destinationName}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {trip.startDate ? formatDateRange(trip.startDate, trip.endDate) : `${trip.dayCount} day${trip.dayCount === 1 ? "" : "s"} · dates not set`}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> {trip.travelers}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function TripCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-surface">
      <Skeleton className="aspect-[16/9] rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
