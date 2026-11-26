"use client";

import { AlertTriangle, Clock, Lightbulb, Lock, MapPin, Wallet } from "lucide-react";
import type { PlanProposal } from "@/types/api";
import { EngineBadge, EstimateBadge } from "@/components/common/labels";
import { Badge } from "@/components/ui/misc";
import { CATEGORY_COLORS } from "@/components/maps/types";
import { formatDate, formatDuration, formatTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { titleCase } from "@/lib/utils";

/** Read-only rendering of a plan proposal. Nothing here is saved until the user applies it. */
export function ProposalView({ proposal }: { proposal: PlanProposal }) {
  const p = proposal;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <EngineBadge label={p.engine.label} simulated={p.engine.simulated} />
        <Badge tone={p.budgetStatus === "OVER" ? "terracotta" : p.budgetStatus === "WITHIN" ? "sage" : "neutral"}>
          <Wallet />
          {formatMoney(p.estimatedTotal, p.currency, { noDecimals: true })} total
          {p.budgetStatus === "OVER" ? " · over budget" : p.budgetStatus === "WITHIN" ? " · within budget" : ""}
        </Badge>
        <EstimateBadge />
      </div>
      <p className="text-[15px] leading-relaxed">{p.summary}</p>

      {p.warnings.length > 0 && (
        <ul className="space-y-1.5 rounded-lg bg-amber-soft p-4 text-sm">
          {p.warnings.map((w, i) => (
            <li key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />{w}</li>
          ))}
        </ul>
      )}

      <ol className="space-y-6">
        {p.days.map((day) => (
          <li key={day.dayNumber}>
            <h3 className="font-display text-base font-semibold">
              Day {day.dayNumber}
              {day.date && <span className="font-normal text-ink-muted"> · {formatDate(day.date, { weekday: "short", year: undefined })}</span>}
              {day.title && <span className="font-normal text-ink-muted"> — {day.title}</span>}
            </h3>
            <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
              {day.items.map((it, i) => (
                <li key={i} className="relative">
                  <span
                    className="absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-surface"
                    style={{ background: CATEGORY_COLORS[it.category] ?? "#58745B" }}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="w-14 text-xs tabular-nums text-ink-muted">{formatTime(it.startTime)}</span>
                    <span className="font-medium">{it.title}</span>
                    {it.locked && <Lock className="size-3.5 text-sage" aria-label="Kept from your plan" />}
                  </div>
                  <p className="ml-16 mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] text-ink-muted">
                    <span>{titleCase(it.category)}</span>
                    {it.locationName && it.locationName !== it.title && <span className="flex items-center gap-1"><MapPin className="size-3" aria-hidden />{it.locationName}</span>}
                    {it.durationMinutes != null && <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden />{formatDuration(it.durationMinutes)}</span>}
                    {it.estimatedCost && it.estimatedCost !== "0.00" && <span>~{formatMoney(it.estimatedCost, it.currency, { noDecimals: true })}</span>}
                  </p>
                  {it.reason && <p className="ml-16 mt-0.5 text-[12.5px] italic text-ink-muted">{it.reason}</p>}
                  {it.alternatives.length > 0 && (
                    <p className="ml-16 mt-0.5 text-[12px] text-ink-muted">Alternatives: {it.alternatives.join(", ")}</p>
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      {(p.tips.length > 0 || p.assumptions.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {p.tips.length > 0 && (
            <div className="rounded-lg bg-surface-muted/60 p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Lightbulb className="size-4 text-amber" /> Tips</h4>
              <ul className="space-y-1 text-[13px] text-ink/85">{p.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
            </div>
          )}
          {p.assumptions.length > 0 && (
            <div className="rounded-lg bg-surface-muted/60 p-4">
              <h4 className="mb-2 text-sm font-semibold">Assumptions</h4>
              <ul className="space-y-1 text-[13px] text-ink/85">{p.assumptions.map((t, i) => <li key={i}>• {t}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
