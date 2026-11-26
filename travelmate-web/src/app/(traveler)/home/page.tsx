"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Compass, MapPin, Plus, Sparkles, Users } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useTrips } from "@/features/trips/hooks";
import { useDestinations, useFavorites } from "@/features/destinations/hooks";
import { useProfileStats } from "@/features/profile/hooks";
import { useItinerary } from "@/features/itinerary/hooks";
import { DestinationCard, DestinationCardSkeleton } from "@/components/destinations/destination-card";
import { TripCard, countdownLabel, tripCover } from "@/components/trips/trip-card";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/misc";
import { formatDateRange, greeting } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { TripDto } from "@/types/api";
import { tripHref } from "@/lib/routes";

function UpcomingTrip({ trip }: { trip: TripDto }) {
  const itinerary = useItinerary(trip.id);
  const items = itinerary.data?.days.flatMap((d) => d.items) ?? [];
  const planned = items.length;
  const daysWithPlans = itinerary.data?.days.filter((d) => d.items.length > 0).length ?? 0;
  const cover = tripCover(trip);
  const countdown = countdownLabel(trip);
  return (
    <Link href={tripHref(trip.id)} className="group relative isolate block overflow-hidden rounded-xl bg-forest text-white">
      {cover && <Image src={cover} alt="" fill sizes="(min-width: 1024px) 66vw, 100vw" className="-z-10 object-cover opacity-70 transition-transform duration-700 group-hover:scale-[1.02]" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      <div className="flex min-h-[280px] flex-col justify-end p-6 sm:p-8">
        {countdown && <span className="mb-3 w-fit rounded-full bg-amber px-3 py-1 text-xs font-semibold text-forest">{countdown}</span>}
        <p className="text-sm text-white/75">Your next trip</p>
        <h2 className="font-display text-3xl font-semibold">{trip.name}</h2>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
          <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{trip.destinationName}</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{trip.startDate ? formatDateRange(trip.startDate, trip.endDate) : "Dates not set"} · {trip.dayCount} days</span>
          <span className="flex items-center gap-1.5"><Users className="size-4" aria-hidden />{trip.travelers}</span>
        </p>
        <div className="mt-5 max-w-sm">
          <div className="mb-1.5 flex justify-between text-xs text-white/75">
            <span>Planning</span>
            <span>{daysWithPlans} of {trip.dayCount} days planned · {planned} activities</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-amber" style={{ width: `${trip.dayCount ? (daysWithPlans / trip.dayCount) * 100 : 0}%` }} />
          </div>
        </div>
        <span className="mt-5 flex w-fit items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-medium text-forest">
          View trip <ArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const trips = useTrips();
  const stats = useProfileStats();
  const favorites = useFavorites();
  const featured = useDestinations({ featured: true, size: 4, sort: "featured" });
  const budget = useDestinations({ sort: "budget", size: 4 });

  const active = (trips.data ?? []).filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const next =
    [...active].filter((t) => t.startDate).sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0] ?? active[0];
  const others = active.filter((t) => t.id !== next?.id).slice(0, 3);
  const savedDestinations = (favorites.data ?? []).flatMap((f) => (f.destination ? [f.destination] : [])).slice(0, 4);
  const firstName = user?.displayName.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-muted">{greeting()},</p>
          <h1 className="font-display text-3xl font-semibold">{firstName}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild><Link href="/explore"><Compass /> Explore</Link></Button>
          <Button asChild><Link href="/planner"><Sparkles /> Plan a trip</Link></Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {trips.isLoading ? (
            <Skeleton className="h-[280px] rounded-xl" />
          ) : trips.isError ? (
            <ErrorState error={trips.error} onRetry={() => trips.refetch()} />
          ) : next ? (
            <UpcomingTrip trip={next} />
          ) : (
            <div className="flex min-h-[280px] flex-col justify-center rounded-xl bg-sage-soft p-8">
              <h2 className="font-display text-2xl font-semibold">Where are you headed next?</h2>
              <p className="mt-2 max-w-md text-sm text-ink-muted">Tell the planner a destination and how many days you have. You&apos;ll get a plan you can edit, map and budget.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild><Link href="/planner"><Sparkles /> Plan with AI</Link></Button>
                <Button variant="secondary" asChild><Link href="/trips/new"><Plus /> Create a trip</Link></Button>
              </div>
            </div>
          )}
        </div>
        <Card className="p-6">
          <h2 className="font-display text-base font-semibold">Your travels</h2>
          {stats.isLoading ? (
            <Skeleton className="mt-4 h-32" />
          ) : stats.data ? (
            <>
              <div className="mt-5 grid grid-cols-2 gap-6">
                <StatTile label="Trips planned" value={stats.data.tripsTotal} />
                <StatTile label="Trips completed" value={stats.data.tripsCompleted} />
                <StatTile label="Places visited" value={stats.data.destinationsVisited} />
                <StatTile label="Days traveling" value={stats.data.totalTravelDays} />
              </div>
              <div className="mt-6 border-t border-line pt-4 text-sm">
                <p className="text-xs text-ink-muted">Logged spending</p>
                {stats.data.spending.length === 0 ? (
                  <p className="mt-1 text-ink-muted">No expenses yet</p>
                ) : (
                  stats.data.spending.map((s) => <p key={s.currency} className="mt-1 font-medium">{formatMoney(s.amount, s.currency)}</p>)
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Stats unavailable.</p>
          )}
        </Card>
      </div>

      {others.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Other trips in the works</h2>
            <Link href="/trips" className="text-sm font-medium text-sage hover:underline">All trips</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{others.map((t) => <TripCard key={t.id} trip={t} />)}</div>
        </section>
      )}

      {savedDestinations.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Saved destinations</h2>
            <Link href="/saved" className="text-sm font-medium text-sage hover:underline">All saved</Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{savedDestinations.map((d) => <DestinationCard key={d.id} destination={{ ...d, saved: true }} />)}</div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Featured right now</h2>
          <Link href="/explore" className="text-sm font-medium text-sage hover:underline">Explore</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.isLoading ? Array.from({ length: 4 }, (_, i) => <DestinationCardSkeleton key={i} />) : featured.data?.items.map((d) => <DestinationCard key={d.id} destination={d} />)}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Easy on the wallet</h2>
          <Link href="/explore?sort=budget" className="text-sm font-medium text-sage hover:underline">More budget trips</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {budget.isLoading ? Array.from({ length: 4 }, (_, i) => <DestinationCardSkeleton key={i} />) : budget.data?.items.map((d) => <DestinationCard key={d.id} destination={d} />)}
        </div>
      </section>

      {active.length > 0 && (
        <section className="rounded-xl bg-amber-soft p-6">
          <h2 className="font-display text-base font-semibold">Pack smarter for {next?.destinationName}</h2>
          <p className="mt-1 text-sm text-ink-muted">Get a checklist based on the weather, the trip length and what you&apos;ll be doing.</p>
          <Button className="mt-4" size="sm" variant="secondary" asChild>
            <Link href={tripHref(next?.id ?? "", "checklist")}>Open checklist <ArrowRight /></Link>
          </Button>
        </section>
      )}
    </div>
  );
}
