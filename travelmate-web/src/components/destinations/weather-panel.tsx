"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, Wind } from "lucide-react";
import { useWeather } from "@/features/destinations/hooks";
import { SourceLabel } from "@/components/common/labels";
import { Skeleton } from "@/components/ui/misc";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** WMO weather code → icon (codes per Open-Meteo docs). */
export function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const cls = cn("size-5", className);
  if (code === 0) return <Sun className={cls} aria-hidden />;
  if (code <= 2) return <CloudSun className={cls} aria-hidden />;
  if (code === 3) return <Cloud className={cls} aria-hidden />;
  if (code <= 48) return <CloudFog className={cls} aria-hidden />;
  if (code <= 57) return <CloudDrizzle className={cls} aria-hidden />;
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain className={cls} aria-hidden />;
  if (code <= 77 || code === 85 || code === 86) return <CloudSnow className={cls} aria-hidden />;
  return <CloudLightning className={cls} aria-hidden />;
}

export function WeatherPanel({ slug, compact }: { slug: string; compact?: boolean }) {
  const { data, isLoading, isError, refetch } = useWeather(slug);

  if (isLoading) return <Skeleton className={compact ? "h-20" : "h-44"} />;
  if (isError || !data)
    return (
      <div className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-muted">
        Weather is unavailable right now.{" "}
        <button className="text-sage underline" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );

  const days = data.daily.slice(0, compact ? 3 : 7);
  return (
    <div className="space-y-3">
      {data.current && (
        <div className="flex items-center gap-4">
          <WeatherIcon code={data.current.weatherCode} className="size-9 text-amber" />
          <div>
            <p className="font-display text-2xl font-semibold">{Math.round(data.current.temperatureC)}°C</p>
            <p className="text-sm text-ink-muted">
              {data.current.description} · feels {Math.round(data.current.apparentC)}°
            </p>
          </div>
          <p className="ml-auto flex items-center gap-1 text-xs text-ink-muted">
            <Wind className="size-3.5" aria-hidden /> {Math.round(data.current.windKph)} km/h
          </p>
        </div>
      )}
      <ul className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-4 sm:grid-cols-7")}>
        {days.map((d) => (
          <li key={d.date} className="rounded-md bg-surface-muted/70 px-2 py-2 text-center">
            <p className="text-[11px] text-ink-muted">{formatDate(d.date, { weekday: "short", day: "numeric", month: undefined, year: undefined })}</p>
            <WeatherIcon code={d.weatherCode} className="mx-auto my-1 size-4 text-sage" />
            <p className="text-xs font-medium">
              {Math.round(d.maxC)}° <span className="text-ink-muted">{Math.round(d.minC)}°</span>
            </p>
            {d.precipitationProbability != null && d.precipitationProbability >= 30 && (
              <p className="text-[10.5px] text-ink-muted">{d.precipitationProbability}% rain</p>
            )}
          </li>
        ))}
      </ul>
      <SourceLabel provenance={data.provenance} />
    </div>
  );
}
