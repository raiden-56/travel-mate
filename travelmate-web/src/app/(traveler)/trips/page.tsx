"use client";

import * as React from "react";
import Link from "next/link";
import { Map, Plus, Sparkles } from "lucide-react";
import { useTrips } from "@/features/trips/hooks";
import { TripCard, TripCardSkeleton } from "@/components/trips/trip-card";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TripDto } from "@/types/api";

const tabs = [
  { key: "active", label: "Active" },
  { key: "past", label: "Past" },
  { key: "archived", label: "Archived" },
] as const;

function bucket(trip: TripDto): "active" | "past" {
  return trip.status === "COMPLETED" || trip.status === "CANCELLED" ? "past" : "active";
}

export default function TripsPage() {
  const [tab, setTab] = React.useState<(typeof tabs)[number]["key"]>("active");
  const trips = useTrips({ archived: tab === "archived" });
  const visible = trips.data?.filter((t) => tab === "archived" || bucket(t) === tab) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="My trips"
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/planner"><Sparkles /> Plan with AI</Link>
            </Button>
            <Button asChild>
              <Link href="/trips/new"><Plus /> New trip</Link>
            </Button>
          </>
        }
      />
      <div role="tablist" aria-label="Trip filter" className="mb-6 inline-flex rounded-lg bg-surface-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium", tab === t.key ? "bg-surface shadow-[var(--shadow-soft)]" : "text-ink-muted")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {trips.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <TripCardSkeleton key={i} />)}</div>
      ) : trips.isError ? (
        <ErrorState error={trips.error} onRetry={() => trips.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Map />}
          title={tab === "active" ? "No trips in the works" : tab === "past" ? "No past trips yet" : "Nothing archived"}
          description={tab === "active" ? "Create a trip from scratch or let the planner draft one for you." : undefined}
          action={
            tab === "active" ? (
              <Button asChild>
                <Link href="/planner"><Sparkles /> Plan a trip</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => <TripCard key={t.id} trip={t} />)}
        </div>
      )}
    </div>
  );
}
