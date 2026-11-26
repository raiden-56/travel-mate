"use client";

import * as React from "react";
import { TravelMap, CATEGORY_COLORS } from "@/components/maps/travel-map";
import type { AttractionDto } from "@/types/api";
import { formatDuration } from "@/lib/dates";
import { titleCase } from "@/lib/utils";

export function AttractionMap({ attractions, center }: { attractions: AttractionDto[]; center: { lat: number; lng: number } }) {
  const [filter, setFilter] = React.useState<string | null>(null);
  const categories = Array.from(new Set(attractions.map((a) => a.category)));
  const visible = filter ? attractions.filter((a) => a.category === filter) : attractions;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap gap-1.5 border-b border-line p-3" role="group" aria-label="Filter map by category">
        <button
          onClick={() => setFilter(null)}
          aria-pressed={filter === null}
          className={`rounded-full px-3 py-1 text-xs font-medium ${filter === null ? "bg-forest text-on-forest" : "bg-surface-muted text-ink-muted"}`}
        >
          All ({attractions.length})
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            aria-pressed={filter === c}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${filter === c ? "bg-forest text-on-forest" : "bg-surface-muted text-ink-muted"}`}
          >
            <span className="size-2 rounded-full" style={{ background: CATEGORY_COLORS[c] ?? "#58745B" }} />
            {titleCase(c)}
          </button>
        ))}
      </div>
      <div className="h-[380px] sm:h-[460px]">
        <TravelMap
          center={center}
          fitKey={visible.map((a) => a.id).join(",")}
          markers={visible.map((a) => ({
            id: a.id,
            lat: a.latitude,
            lng: a.longitude,
            title: a.name,
            color: CATEGORY_COLORS[a.category] ?? "#58745B",
            popup: (
              <div className="min-w-44">
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-gray-600">
                  {titleCase(a.category)} · {formatDuration(a.typicalDurationMinutes)}
                </p>
                <a href={`#attraction-${a.slug}`} className="mt-1 inline-block text-xs text-[#58745B] underline">
                  Details
                </a>
              </div>
            ),
          }))}
        />
      </div>
      <p className="border-t border-line px-3 py-2 text-[11.5px] text-ink-muted">
        Pin locations are approximate (curated sample data). Check on the ground before you go.
      </p>
    </div>
  );
}
