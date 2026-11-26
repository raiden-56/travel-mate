"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, MapPin, Users } from "lucide-react";
import { useTrip } from "@/features/trips/hooks";
import { ErrorState } from "@/components/common/states";
import { TripStatusChip } from "@/components/common/labels";
import { TripActions } from "@/components/trips/trip-actions";
import { countdownLabel, tripCover } from "@/components/trips/trip-card";
import { Skeleton } from "@/components/ui/misc";
import { formatDateRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "", label: "Overview" },
  { href: "/itinerary", label: "Itinerary" },
  { href: "/map", label: "Map" },
  { href: "/budget", label: "Budget" },
  { href: "/checklist", label: "Checklist" },
  { href: "/settings", label: "Settings" },
];

export default function TripWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const trip = useTrip(id);
  const base = `/trips/${id}`;

  if (trip.isLoading)
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-36" />
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-80" />
      </div>
    );
  if (trip.isError || !trip.data)
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ErrorState error={trip.error} onRetry={() => trip.refetch()} />
      </div>
    );

  const t = trip.data;
  const cover = tripCover(t);
  const countdown = countdownLabel(t);

  return (
    <div>
      <div className="relative isolate overflow-hidden bg-forest">
        {cover && <Image src={cover} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-45" priority />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-forest via-forest/80 to-forest/30" />
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-5 sm:px-6">
          <Link href="/trips" className="inline-flex items-center gap-1 text-[13px] text-white/70 hover:text-white">
            <ChevronLeft className="size-4" /> My trips
          </Link>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-2xl font-semibold text-white sm:text-3xl">{t.name}</h1>
                <TripStatusChip status={t.status} />
                {t.archived && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] text-white">Archived</span>}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden />
                  {t.destination ? (
                    <Link href={`/destinations/${t.destination.slug}`} className="hover:underline">{t.destinationName}</Link>
                  ) : (
                    t.destinationName
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {t.startDate ? formatDateRange(t.startDate, t.endDate) : `${t.dayCount} days · no dates yet`}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden /> {t.travelers} traveler{t.travelers === 1 ? "" : "s"}
                </span>
                {countdown && <span className="rounded-full bg-amber px-2 py-0.5 text-xs font-medium text-forest">{countdown}</span>}
              </p>
            </div>
            <TripActions trip={t} />
          </div>
        </div>
      </div>

      <nav aria-label="Trip sections" className="sticky top-16 z-30 border-b border-line bg-canvas/95 backdrop-blur">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((tab) => {
            const href = `${base}${tab.href}`;
            const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
            return (
              <li key={tab.label}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                    active ? "border-terracotta text-ink" : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
