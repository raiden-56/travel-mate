"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, MapPin } from "lucide-react";
import type { DestinationSummary } from "@/types/api";
import { formatMoneyRange } from "@/lib/money";
import { SaveButton } from "@/components/common/save-button";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function DestinationImage({
  src,
  alt,
  name,
  sizes,
  priority,
  className,
}: {
  src: string | null;
  alt: string;
  name: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    // Honest fallback: no stock photo pretending to be the place.
    return (
      <div className={cn("absolute inset-0 grid place-items-end bg-gradient-to-br from-sage to-forest p-4", className)}>
        <span className="font-display text-3xl font-bold text-white/25">{name}</span>
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} />;
}

export function DestinationCard({
  destination: d,
  size = "md",
  distanceKm,
}: {
  destination: DestinationSummary;
  size?: "md" | "lg";
  distanceKm?: number;
}) {
  return (
    <motion.article whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className="group relative">
      <Link href={`/destinations/${d.slug}`} className="block focus-visible:outline-none">
        <div
          className={cn(
            "relative overflow-hidden rounded-lg bg-surface-muted",
            size === "lg" ? "aspect-[4/5]" : "aspect-[4/3]",
          )}
        >
          <DestinationImage
            src={d.heroImageUrl}
            alt={`${d.name}, ${d.state}`}
            name={d.name}
            sizes={size === "lg" ? "(min-width: 1024px) 33vw, 90vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw"}
            className="transition-transform duration-700 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          {size === "lg" && (
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="font-display text-xl font-semibold">{d.name}</p>
              <p className="text-sm text-white/80">{d.region}</p>
            </div>
          )}
          {d.categories[0] && (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11.5px] font-medium text-ink">
              {d.categories[0].name}
            </span>
          )}
        </div>
        {size === "md" && (
          <div className="mt-3 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-[15.5px] font-semibold group-hover:text-sage">{d.name}</h3>
              {distanceKm != null && <span className="text-xs text-ink-muted">{Math.round(distanceKm)} km away</span>}
            </div>
            <p className="flex items-center gap-1 text-[13px] text-ink-muted">
              <MapPin className="size-3.5" aria-hidden /> {d.region}, {d.state}
            </p>
            <p className="flex items-center gap-3 text-[13px] text-ink-muted">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden /> {d.recommendedDaysMin}–{d.recommendedDaysMax} days
              </span>
              <span title="Estimated per person per day">
                {formatMoneyRange(d.budgetPerDayMin, d.budgetPerDayMax, d.currency)}/day
              </span>
            </p>
          </div>
        )}
      </Link>
      <div className="absolute right-3 top-3">
        <SaveButton targetType="DESTINATION" targetId={d.id} saved={d.saved} name={d.name} variant="overlay" />
      </div>
    </motion.article>
  );
}

export function DestinationCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/3] rounded-lg" />
      <Skeleton className="mt-3 h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}
