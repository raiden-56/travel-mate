"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { Clock, Landmark, MapPin, Search, Tag, TrendingUp, X } from "lucide-react";
import { useDebounced } from "@/hooks/use-debounced";
import { usePopularSearches, useSuggestions } from "@/features/destinations/hooks";
import { clearRecentSearches, getRecentSearches, pushRecentSearch } from "@/lib/local-prefs";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@/types/api";

function hrefFor(s: Suggestion): string {
  if (s.type === "DESTINATION") return `/destinations/${s.slug}`;
  if (s.type === "CATEGORY") return `/explore?category=${s.slug}`;
  return `/destinations/${s.destinationSlug}#attraction-${s.slug}`;
}

const typeIcon = { DESTINATION: MapPin, ATTRACTION: Landmark, CATEGORY: Tag } as const;

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [recent, setRecent] = React.useState<string[]>([]);
  const debounced = useDebounced(q, 200);
  const suggestions = useSuggestions(debounced);
  const popular = usePopularSearches();

  React.useEffect(() => {
    if (open) {
      setRecent(getRecentSearches());
      setQ("");
      setActive(0);
    }
  }, [open]);

  const items = q.trim().length >= 2 ? (suggestions.data ?? []) : [];

  const go = (href: string, term?: string) => {
    if (term) pushRecentSearch(term);
    onOpenChange(false);
    router.push(href);
  };

  const submit = () => {
    const pick = items[active];
    if (pick) go(hrefFor(pick), q);
    else if (q.trim().length >= 2) go(`/search?q=${encodeURIComponent(q.trim())}`, q);
  };

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-forest/30 backdrop-blur-[2px]" />
        <D.Content
          className="fixed left-1/2 top-[8vh] z-50 w-[calc(100%-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-lift)] focus:outline-none"
          aria-describedby={undefined}
        >
          <D.Title className="sr-only">Search TravelMate</D.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 text-ink-muted" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Search destinations, beaches, temples, waterfalls…"
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-muted"
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls="tm-search-list"
              aria-activedescendant={items[active] ? `tm-s-${active}` : undefined}
            />
            <D.Close className="rounded p-1 text-ink-muted hover:bg-surface-muted" aria-label="Close search">
              <X className="size-4" />
            </D.Close>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length >= 2 ? (
              suggestions.isLoading ? (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">Searching…</p>
              ) : suggestions.isError ? (
                <p className="px-3 py-6 text-center text-sm text-danger">Search is unavailable right now.</p>
              ) : items.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-ink-muted">
                  No matches for “{q}”.{" "}
                  <button className="text-sage underline" onClick={() => go(`/search?q=${encodeURIComponent(q)}`, q)}>
                    See all results
                  </button>
                </div>
              ) : (
                <ul id="tm-search-list" role="listbox">
                  {items.map((s, i) => {
                    const Icon = typeIcon[s.type];
                    return (
                      <li key={`${s.type}-${s.slug}`} id={`tm-s-${i}`} role="option" aria-selected={i === active}>
                        <button
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(hrefFor(s), q)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left",
                            i === active && "bg-surface-muted",
                          )}
                        >
                          <Icon className="size-4 shrink-0 text-sage" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{s.label}</span>
                            {s.sublabel && <span className="block truncate text-xs text-ink-muted">{s.sublabel}</span>}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                            {s.type.toLowerCase()}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  <li>
                    <button
                      onClick={() => go(`/search?q=${encodeURIComponent(q)}`, q)}
                      className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-sage hover:bg-surface-muted"
                    >
                      See all results for “{q}”
                    </button>
                  </li>
                </ul>
              )
            ) : (
              <div className="space-y-4 p-2">
                {recent.length > 0 && (
                  <section>
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <h3 className="text-xs font-medium text-ink-muted">Recent searches</h3>
                      <button
                        className="text-xs text-ink-muted hover:text-ink"
                        onClick={() => {
                          clearRecentSearches();
                          setRecent([]);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recent.map((r) => (
                        <button
                          key={r}
                          onClick={() => setQ(r)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm hover:bg-surface-muted"
                        >
                          <Clock className="size-3.5 text-ink-muted" aria-hidden /> {r}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {popular.data && popular.data.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 px-1 text-xs font-medium text-ink-muted">Popular</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {popular.data.map((p) => (
                        <button
                          key={p}
                          onClick={() => setQ(p)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-sm hover:bg-sage-soft"
                        >
                          <TrendingUp className="size-3.5 text-sage" aria-hidden /> {p}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <p className="px-1 text-xs text-ink-muted">Type at least two letters to search.</p>
              </div>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
