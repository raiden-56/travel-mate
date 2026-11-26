import { AlertTriangle, Info } from "lucide-react";
import type { ItineraryWarning } from "@/types/api";
import { cn } from "@/lib/utils";

export function WarningsPanel({ warnings }: { warnings: ItineraryWarning[] }) {
  if (warnings.length === 0) return null;
  const serious = warnings.filter((w) => w.severity === "WARNING").length;
  return (
    <details className="rounded-lg border border-amber/40 bg-amber-soft/60" open={serious > 0}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium marker:hidden">
        <AlertTriangle className="size-4 text-amber" aria-hidden />
        {warnings.length} thing{warnings.length === 1 ? "" : "s"} to check in this plan
        <span className="ml-auto text-xs font-normal text-ink-muted">Suggestions only — nothing is changed automatically</span>
      </summary>
      <ul className="space-y-2 px-4 pb-4">
        {warnings.map((w, i) => (
          <li key={i} className="flex gap-2 text-[13px]">
            {w.severity === "WARNING" ? (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" aria-label="Warning" />
            ) : (
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-muted" aria-label="Note" />
            )}
            <span className={cn(w.severity === "INFO" && "text-ink-muted")}>
              {w.dayNumber != null && (
                <a href={`#day-${w.dayNumber}`} className="mr-1 font-medium text-ink underline-offset-2 hover:underline">
                  Day {w.dayNumber}:
                </a>
              )}
              {w.message}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
