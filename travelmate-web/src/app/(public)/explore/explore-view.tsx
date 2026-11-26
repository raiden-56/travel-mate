"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LocateFixed, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useCategories, useDestinations, useNearbyDestinations, type DestinationFilters } from "@/features/destinations/hooks";
import { useDebounced } from "@/hooks/use-debounced";
import { DestinationCard, DestinationCardSkeleton } from "@/components/destinations/destination-card";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Pagination } from "@/components/common/pagination";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const budgetOptions = [
  { value: "", label: "Any budget" },
  { value: "2000", label: "Under ₹2,000/day" },
  { value: "3500", label: "Under ₹3,500/day" },
  { value: "5000", label: "Under ₹5,000/day" },
];
const daysOptions = [
  { value: "", label: "Any length" },
  { value: "2", label: "Weekend (≤2 days)" },
  { value: "3", label: "Up to 3 days" },
  { value: "5", label: "Up to 5 days" },
];

export function ExploreView() {
  const pathname = usePathname();
  const params = useSearchParams();
  const categories = useCategories();

  const filters: DestinationFilters = {
    q: params.get("q") ?? undefined,
    category: params.get("category") ?? undefined,
    budgetMax: params.get("budgetMax") ?? undefined,
    maxDays: params.get("maxDays") ? Number(params.get("maxDays")) : undefined,
    sort: (params.get("sort") as DestinationFilters["sort"]) ?? "featured",
    page: params.get("page") ? Number(params.get("page")) : 0,
    size: 12,
  };

  const [q, setQ] = React.useState(filters.q ?? "");
  const debouncedQ = useDebounced(q, 300);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Set once the user clicks a link that leaves this page, so a pending debounced URL sync
  // can't supersede (and silently cancel) their navigation.
  const leaving = React.useRef(false);
  const onClickCapture = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a[href]");
    if (a && new URL((a as HTMLAnchorElement).href, window.location.href).pathname !== pathname) leaving.current = true;
  };

  const update = React.useCallback(
    (patch: Record<string, string | undefined>) => {
      if (leaving.current) return;
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in patch)) next.delete("page");
      // history.replaceState (synced into useSearchParams by Next) instead of router.replace:
      // a router navigation here would cancel a click on a result made during the search debounce.
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname],
  );

  React.useEffect(() => {
    if ((filters.q ?? "") !== debouncedQ) update({ q: debouncedQ || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const list = useDestinations(filters);
  const nearby = useNearbyDestinations(coords);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: Number(pos.coords.latitude.toFixed(3)), lng: Number(pos.coords.longitude.toFixed(3)) });
        setLocating(false);
      },
      () => {
        toast.error("We couldn't get your location. You can still browse everything below.");
        setLocating(false);
      },
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  const activeCount = [filters.budgetMax, filters.maxDays].filter(Boolean).length;
  const selectedCategory = categories.data?.find((c) => c.slug === filters.category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" onClickCapture={onClickCapture}>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">
          {selectedCategory ? selectedCategory.name : "Explore destinations"}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Curated places in and around Karnataka, with honest budgets and real maps.</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, region or activity"
            className="h-11 pl-9"
            aria-label="Search destinations"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-11 lg:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <SlidersHorizontal /> Filters {activeCount > 0 && `(${activeCount})`}
          </Button>
          <div className={cn("gap-2", filtersOpen ? "flex flex-col sm:flex-row" : "hidden lg:flex")}>
            <Select aria-label="Budget" className="h-11 w-auto" value={filters.budgetMax ?? ""} onChange={(e) => update({ budgetMax: e.target.value || undefined })}>
              {budgetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Select aria-label="Trip length" className="h-11 w-auto" value={filters.maxDays?.toString() ?? ""} onChange={(e) => update({ maxDays: e.target.value || undefined })}>
              {daysOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Select aria-label="Sort" className="h-11 w-auto" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="featured">Featured first</option>
              <option value="name">Name A–Z</option>
              <option value="budget">Lowest budget</option>
            </Select>
          </div>
          <Button variant="secondary" className="h-11" onClick={locate} loading={locating} aria-label="Find destinations near me">
            <LocateFixed /> <span className="hidden sm:inline">Near me</span>
          </Button>
        </div>
      </div>

      <div className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Categories">
        <button
          onClick={() => update({ category: undefined })}
          aria-pressed={!filters.category}
          className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium", !filters.category ? "bg-forest text-on-forest" : "bg-surface text-ink-muted hover:text-ink")}
        >
          All
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.slug}
            onClick={() => update({ category: filters.category === c.slug ? undefined : c.slug })}
            aria-pressed={filters.category === c.slug}
            className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium", filters.category === c.slug ? "bg-forest text-on-forest" : "bg-surface text-ink-muted hover:text-ink")}
          >
            {c.name}
          </button>
        ))}
      </div>

      {coords && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Within 400 km of you</h2>
            <button onClick={() => setCoords(null)} className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
              <X className="size-4" /> Clear
            </button>
          </div>
          {nearby.isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <DestinationCardSkeleton key={i} />)}</div>
          ) : nearby.isError ? (
            <ErrorState error={nearby.error} onRetry={() => nearby.refetch()} />
          ) : nearby.data?.length === 0 ? (
            <EmptyState title="Nothing nearby yet" description="None of our destinations are within 400 km of your location." />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {nearby.data?.map((d) => <DestinationCard key={d.id} destination={d} distanceKm={d.distanceKm} />)}
            </div>
          )}
        </section>
      )}

      <section className="mt-10" aria-live="polite">
        {list.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <DestinationCardSkeleton key={i} />)}</div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data && list.data.items.length === 0 ? (
          <EmptyState
            title="No destinations match"
            description="Try a different search, or loosen the budget and trip-length filters."
            action={<Button variant="secondary" onClick={() => { setQ(""); window.history.replaceState(null, "", pathname); }}>Reset filters</Button>}
          />
        ) : list.data ? (
          <>
            <p className="mb-4 text-sm text-ink-muted">
              {list.data.totalItems} destination{list.data.totalItems === 1 ? "" : "s"}
            </p>
            <div className={cn("grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3", list.isFetching && "opacity-70 transition-opacity")}>
              {list.data.items.map((d) => <DestinationCard key={d.id} destination={d} />)}
            </div>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={(p) => update({ page: String(p) })} />
          </>
        ) : null}
      </section>
    </div>
  );
}
