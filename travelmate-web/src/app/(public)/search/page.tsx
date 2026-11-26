"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Landmark } from "lucide-react";
import { useSearch } from "@/features/destinations/hooks";
import { DestinationCard, DestinationCardSkeleton } from "@/components/destinations/destination-card";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/misc";
import { SaveButton } from "@/components/common/save-button";
import { formatDuration } from "@/lib/dates";
import { titleCase } from "@/lib/utils";

function Results() {
  const q = useSearchParams().get("q") ?? "";
  const search = useSearch(q);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">
        {q ? <>Results for “{q}”</> : "Search"}
      </h1>
      {q.trim().length < 2 ? (
        <p className="mt-4 text-sm text-ink-muted">Type at least two letters to search.</p>
      ) : search.isLoading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <DestinationCardSkeleton key={i} />)}</div>
      ) : search.isError ? (
        <ErrorState className="mt-8" error={search.error} onRetry={() => search.refetch()} />
      ) : search.data && search.data.destinations.length + search.data.attractions.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No matches"
          description="Try a place name like “Gokarna”, or a kind of place like “waterfall”."
          action={<Link href="/explore" className="text-sm font-medium text-sage underline">Browse all destinations</Link>}
        />
      ) : search.data ? (
        <div className="mt-8 space-y-12">
          {search.data.destinations.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold">Destinations</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {search.data.destinations.map((d) => <DestinationCard key={d.id} destination={d} />)}
              </div>
            </section>
          )}
          {search.data.attractions.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-lg font-semibold">Places & things to do</h2>
              <ul className="divide-y divide-line rounded-lg bg-surface shadow-[var(--shadow-soft)]">
                {search.data.attractions.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 p-4">
                    <Landmark className="size-5 shrink-0 text-sage" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={`/destinations/${a.destinationSlug}#attraction-${a.slug}`} className="font-medium hover:text-sage">
                        {a.name}
                      </Link>
                      <p className="text-[13px] text-ink-muted">
                        {titleCase(a.destinationSlug)} · {formatDuration(a.typicalDurationMinutes)}
                      </p>
                    </div>
                    <Badge tone="sage">{titleCase(a.category)}</Badge>
                    <SaveButton targetType="ATTRACTION" targetId={a.id} saved={a.saved} name={a.name} variant="overlay" className="border border-line" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <Results />
    </Suspense>
  );
}
