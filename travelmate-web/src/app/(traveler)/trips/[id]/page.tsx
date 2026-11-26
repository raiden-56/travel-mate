"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CheckSquare, ListChecks, Sparkles, Wallet } from "lucide-react";
import { useTrip } from "@/features/trips/hooks";
import { useItinerary } from "@/features/itinerary/hooks";
import { useBudget } from "@/features/budget/hooks";
import { useChecklists } from "@/features/checklist/hooks";
import { WeatherPanel } from "@/components/destinations/weather-panel";
import { Card, Progress, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { EstimateBadge } from "@/components/common/labels";
import { formatMoney, percentOf } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";

function SectionTitle({ children, href, linkLabel }: { children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-base font-semibold">{children}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-[13px] font-medium text-sage hover:underline">
          {linkLabel} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

export default function TripOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const trip = useTrip(id).data!;
  const itinerary = useItinerary(id);
  const budget = useBudget(id);
  const checklists = useChecklists(id);
  const base = `/trips/${id}`;

  const allItems = itinerary.data?.days.flatMap((d) => d.items) ?? [];
  const done = allItems.filter((i) => i.status === "COMPLETED").length;
  const checklistTotal = checklists.data?.reduce((a, c) => a + c.totalCount, 0) ?? 0;
  const checklistDone = checklists.data?.reduce((a, c) => a + c.completedCount, 0) ?? 0;
  const nextDay = itinerary.data?.days.find((d) => d.items.some((i) => i.status === "PLANNED" || i.status === "BOOKED"));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="p-5">
          <SectionTitle href={`${base}/itinerary`} linkLabel="Open itinerary">
            {nextDay ? `Up next · Day ${nextDay.dayNumber}${nextDay.date ? ` · ${formatDate(nextDay.date, { weekday: "short", year: undefined })}` : ""}` : "Itinerary"}
          </SectionTitle>
          {itinerary.isLoading ? (
            <Skeleton className="h-32" />
          ) : allItems.length === 0 ? (
            <div className="rounded-lg bg-surface-muted/60 p-6 text-center">
              <p className="font-medium">No plans yet</p>
              <p className="mt-1 text-sm text-ink-muted">Add stops yourself, or let the planner draft a day-by-day plan.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button size="sm" asChild>
                  <Link href={`${base}/itinerary`}>Add activities</Link>
                </Button>
                <Button size="sm" variant="subtle" asChild>
                  <Link href={`/planner?tripId=${id}${trip.destination ? `&destination=${trip.destination.slug}` : ""}`}>
                    <Sparkles /> Draft with planner
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ol className="space-y-3">
                {(nextDay?.items ?? []).slice(0, 5).map((i) => (
                  <li key={i.id} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-ink-muted">{formatTime(i.startTime) || "—"}</span>
                    <span className="size-2 shrink-0 rounded-full bg-sage" aria-hidden />
                    <span className="truncate text-sm font-medium">{i.title}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
                  <span>Trip progress</span>
                  <span>{done} of {allItems.length} activities done</span>
                </div>
                <Progress value={allItems.length ? (done / allItems.length) * 100 : 0} label="Trip progress" />
              </div>
            </>
          )}
        </Card>

        {trip.description && (
          <Card className="p-5">
            <SectionTitle>Notes</SectionTitle>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/85">{trip.description}</p>
          </Card>
        )}

        {trip.destination && (
          <Card className="p-5">
            <SectionTitle href={`/destinations/${trip.destination.slug}`} linkLabel="Destination guide">
              Weather in {trip.destination.name}
            </SectionTitle>
            <WeatherPanel slug={trip.destination.slug} />
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card className="p-5">
          <SectionTitle href={`${base}/budget`} linkLabel="Budget">
            <span className="flex items-center gap-2"><Wallet className="size-4 text-sage" /> Money</span>
          </SectionTitle>
          {budget.isLoading ? (
            <Skeleton className="h-24" />
          ) : budget.data ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Budget</dt>
                <dd className="font-medium">{budget.data.totalBudget ? formatMoney(budget.data.totalBudget, budget.data.currency) : "Not set"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="flex items-center gap-1.5 text-ink-muted">Planned <EstimateBadge /></dt>
                <dd className="font-medium">{formatMoney(budget.data.estimatedItineraryCost, budget.data.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Spent</dt>
                <dd className="font-medium">{formatMoney(budget.data.spent, budget.data.currency)}</dd>
              </div>
              {budget.data.totalBudget && (
                <Progress
                  value={percentOf(budget.data.spent, budget.data.totalBudget)}
                  tone={percentOf(budget.data.spent, budget.data.totalBudget) > 100 ? "danger" : "sage"}
                  label="Budget spent"
                />
              )}
            </dl>
          ) : null}
        </Card>

        <Card className="p-5">
          <SectionTitle href={`${base}/checklist`} linkLabel="Checklist">
            <span className="flex items-center gap-2"><ListChecks className="size-4 text-sage" /> Packing</span>
          </SectionTitle>
          {checklists.isLoading ? (
            <Skeleton className="h-12" />
          ) : checklistTotal === 0 ? (
            <p className="text-sm text-ink-muted">No checklist yet. Start from a template or get suggestions for this trip.</p>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm">
                <CheckSquare className="size-4 text-sage" /> {checklistDone} of {checklistTotal} packed
              </p>
              <Progress className="mt-3" value={(checklistDone / checklistTotal) * 100} label="Packing progress" />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
