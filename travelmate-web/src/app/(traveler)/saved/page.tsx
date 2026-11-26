"use client";

import Link from "next/link";
import { Heart, Landmark } from "lucide-react";
import { useFavorites } from "@/features/destinations/hooks";
import { DestinationCard, DestinationCardSkeleton } from "@/components/destinations/destination-card";
import { EmptyState, ErrorState, PageHeader } from "@/components/common/states";
import { SaveButton } from "@/components/common/save-button";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/dates";
import { titleCase } from "@/lib/utils";

export default function SavedPage() {
  const favorites = useFavorites();
  const destinations = (favorites.data ?? []).flatMap((f) => (f.destination ? [f.destination] : []));
  const places = (favorites.data ?? []).flatMap((f) => (f.attraction ? [f.attraction] : []));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Saved" description="Destinations and places you want to remember." />
      {favorites.isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <DestinationCardSkeleton key={i} />)}</div>
      ) : favorites.isError ? (
        <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
      ) : favorites.data?.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          title="Nothing saved yet"
          description="Tap the heart on any destination or place to keep it here."
          action={<Button asChild><Link href="/explore">Explore destinations</Link></Button>}
        />
      ) : (
        <div className="space-y-12">
          {destinations.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold">Destinations ({destinations.length})</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {destinations.map((d) => <DestinationCard key={d.id} destination={{ ...d, saved: true }} />)}
              </div>
            </section>
          )}
          {places.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold">Places ({places.length})</h2>
              <ul className="divide-y divide-line rounded-lg bg-surface shadow-[var(--shadow-soft)]">
                {places.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 p-4">
                    <Landmark className="size-5 shrink-0 text-sage" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={`/destinations/${a.destinationSlug}#attraction-${a.slug}`} className="font-medium hover:text-sage">{a.name}</Link>
                      <p className="text-[13px] text-ink-muted">{titleCase(a.destinationSlug)} · {formatDuration(a.typicalDurationMinutes)}</p>
                    </div>
                    <Badge tone="sage" className="hidden sm:inline-flex">{titleCase(a.category)}</Badge>
                    <SaveButton targetType="ATTRACTION" targetId={a.id} saved name={a.name} variant="overlay" className="border border-line" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
