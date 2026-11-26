"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAiStatus, useApplyProposal, useGeneratePlan } from "@/features/ai-planner/hooks";
import { useDestinations } from "@/features/destinations/hooks";
import { useTrip } from "@/features/trips/hooks";
import { ProposalView } from "@/components/ai/proposal-view";
import { EngineBadge } from "@/components/common/labels";
import { PageHeader } from "@/components/common/states";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api-client";
import { addDays } from "@/lib/dates";
import { isMoney } from "@/lib/money";
import { cn, titleCase } from "@/lib/utils";
import { TRAVEL_STYLES, type Accommodation, type Pace, type PlanProposal, type PlanRequest, type Transport, type TravelStyle } from "@/types/api";

const INTERESTS = ["beaches", "waterfalls", "temples", "heritage", "forts", "viewpoints", "trekking", "wildlife", "water sports", "islands", "food", "photography", "markets", "sunsets"];

type FormState = {
  destinationSlug: string;
  startLocation: string;
  startDate: string;
  flexibleDates: boolean;
  days: number;
  travelers: number;
  budget: string;
  transport: Transport;
  accommodation: Accommodation;
  styles: TravelStyle[];
  interests: string[];
  pace: Pace;
  dietary: string;
  accessibility: string;
};

const initial: FormState = {
  destinationSlug: "",
  startLocation: "Bengaluru",
  startDate: "",
  flexibleDates: false,
  days: 3,
  travelers: 2,
  budget: "",
  transport: "ROAD_TRIP",
  accommodation: "MIDRANGE",
  styles: [],
  interests: [],
  pace: "BALANCED",
  dietary: "",
  accessibility: "",
};

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        selected ? "border-forest bg-forest text-on-forest" : "border-line bg-surface text-ink-muted hover:border-sage hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

const steps = ["Where & when", "Your style", "Details"];

function Planner() {
  const router = useRouter();
  const params = useSearchParams();
  const tripId = params.get("tripId");
  const existingTrip = useTrip(tripId ?? "");
  const status = useAiStatus();
  const destinations = useDestinations({ size: 100, sort: "name" });
  const generate = useGeneratePlan();
  const apply = useApplyProposal();

  const [form, setForm] = React.useState<FormState>(() => ({ ...initial, destinationSlug: params.get("destination") ?? "" }));
  const [step, setStep] = React.useState(0);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [proposal, setProposal] = React.useState<PlanProposal | null>(null);
  const [tripName, setTripName] = React.useState("");

  // Prefill from an existing trip the user came from.
  const prefilled = React.useRef(false);
  React.useEffect(() => {
    const t = existingTrip.data;
    if (!t || prefilled.current) return;
    prefilled.current = true;
    setForm((f) => ({
      ...f,
      destinationSlug: t.destination?.slug ?? f.destinationSlug,
      startLocation: t.startLocation ?? f.startLocation,
      startDate: t.startDate ?? "",
      days: t.dayCount,
      travelers: t.travelers,
      budget: t.budgetAmount ?? "",
      styles: t.tripType ? [t.tripType] : f.styles,
    }));
  }, [existingTrip.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = <K extends "styles" | "interests">(k: K, v: FormState[K][number]) =>
    setForm((f) => {
      const list = f[k] as string[];
      return { ...f, [k]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
    });

  const validateStep = (s: number) => {
    const e: typeof errors = {};
    if (s === 0) {
      if (!form.destinationSlug) e.destinationSlug = "Choose a destination";
      if (form.days < 1 || form.days > 14) e.days = "Plan between 1 and 14 days";
      if (form.travelers < 1 || form.travelers > 20) e.travelers = "Between 1 and 20 travelers";
    }
    if (s === 1 && form.budget && (!isMoney(form.budget) || form.budget.startsWith("-"))) e.budget = "Enter an amount like 20000";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validateStep(0) || !validateStep(1)) return;
    const body: PlanRequest = {
      destinationSlug: form.destinationSlug,
      startLocation: form.startLocation || undefined,
      startDate: form.startDate || undefined,
      flexibleDates: form.flexibleDates,
      days: form.days,
      travelers: form.travelers,
      budget: form.budget || undefined,
      currency: "INR",
      transport: form.transport,
      accommodation: form.accommodation,
      styles: form.styles,
      interests: form.interests,
      pace: form.pace,
      dietary: form.dietary || undefined,
      accessibility: form.accessibility || undefined,
    };
    generate.mutate(body, {
      onSuccess: (p) => {
        setProposal(p);
        const d = destinations.data?.items.find((x) => x.slug === form.destinationSlug);
        setTripName(`${d?.name ?? "New"} · ${form.days} days`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const save = () => {
    if (!proposal) return;
    const d = destinations.data?.items.find((x) => x.slug === form.destinationSlug);
    const payload = tripId
      ? { proposalId: proposal.id, tripId }
      : {
          proposalId: proposal.id,
          trip: {
            name: tripName.trim() || `${d?.name ?? "Trip"} trip`,
            destinationSlug: form.destinationSlug,
            destinationName: d?.name ?? form.destinationSlug,
            startLocation: form.startLocation || null,
            startDate: form.startDate || null,
            endDate: form.startDate ? addDays(form.startDate, form.days - 1) : null,
            dayCount: form.days,
            travelers: form.travelers,
            tripType: form.styles[0] ?? null,
            budgetAmount: form.budget || null,
            currency: "INR",
          },
        };
    apply.mutate(payload, {
      onSuccess: (trip) => {
        toast.success(tripId ? "Itinerary replaced with the new plan" : "Trip saved");
        router.push(`/trips/${trip.id}/itinerary`);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  if (proposal) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5 sm:p-7">
          <ProposalView proposal={proposal} />
        </Card>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4 p-5">
            <h2 className="font-display text-base font-semibold">{tripId ? "Use this plan?" : "Save this plan"}</h2>
            {tripId ? (
              <p className="text-sm text-ink-muted">
                This replaces the activities in <strong>{existingTrip.data?.name}</strong> that you haven&apos;t kept or booked.
              </p>
            ) : (
              <Field label="Trip name" htmlFor="tripName">
                <Input id="tripName" value={tripName} onChange={(e) => setTripName(e.target.value)} maxLength={120} />
              </Field>
            )}
            <Button className="w-full" size="lg" loading={apply.isPending} onClick={save}>
              {tripId ? "Apply to trip" : "Save as trip"}
            </Button>
            <Button className="w-full" variant="secondary" onClick={submit} loading={generate.isPending}>
              <RotateCcw /> Try again
            </Button>
            <button className="w-full text-center text-sm text-ink-muted hover:text-ink" onClick={() => setProposal(null)}>
              Change preferences
            </button>
          </Card>
          <p className="px-1 text-xs leading-relaxed text-ink-muted">
            Times, costs and travel durations are estimates. Check opening hours and prices locally — nothing here is a booking.
          </p>
        </aside>
      </div>
    );
  }

  return (
    <Card className="mx-auto max-w-3xl p-5 sm:p-8">
      <ol className="mb-8 flex items-center gap-2 text-[13px]" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold", i <= step ? "bg-forest text-on-forest" : "bg-surface-muted text-ink-muted")}>{i + 1}</span>
            <span className={cn("hidden sm:inline", i === step ? "font-medium" : "text-ink-muted")} aria-current={i === step ? "step" : undefined}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line sm:w-10" aria-hidden />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="space-y-5">
          {step === 0 && (
            <>
              <Field label="Destination" htmlFor="dest" error={errors.destinationSlug} hint="The planner works from places we've curated, so every stop is real.">
                <Select id="dest" value={form.destinationSlug} onChange={(e) => set("destinationSlug", e.target.value)} aria-invalid={!!errors.destinationSlug}>
                  <option value="">Choose a destination…</option>
                  {destinations.data?.items.map((d) => <option key={d.slug} value={d.slug}>{d.name}, {d.state}</option>)}
                </Select>
              </Field>
              <Field label="Starting from" htmlFor="start" optional>
                <Input id="start" value={form.startLocation} onChange={(e) => set("startLocation", e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Start date" htmlFor="sd" optional>
                  <Input id="sd" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </Field>
                <Field label="Days" htmlFor="days" error={errors.days}>
                  <Input id="days" type="number" min={1} max={14} value={form.days} onChange={(e) => set("days", Number(e.target.value))} />
                </Field>
                <Field label="Travelers" htmlFor="trav" error={errors.travelers}>
                  <Input id="trav" type="number" min={1} max={20} value={form.travelers} onChange={(e) => set("travelers", Number(e.target.value))} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.flexibleDates} onChange={(e) => set("flexibleDates", e.target.checked)} className="size-4 accent-[var(--sage)]" />
                My dates are flexible
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <p className="mb-2 text-[13px] font-medium">Travel style</p>
                <div className="flex flex-wrap gap-2">
                  {TRAVEL_STYLES.map((s) => <Chip key={s} selected={form.styles.includes(s)} onClick={() => toggle("styles", s)}>{titleCase(s)}</Chip>)}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium">Interests</p>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((s) => <Chip key={s} selected={form.interests.includes(s)} onClick={() => toggle("interests", s)}>{s[0].toUpperCase() + s.slice(1)}</Chip>)}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium">Pace</p>
                <div className="grid grid-cols-3 gap-2">
                  {([["RELAXED", "Relaxed", "2–3 things a day"], ["BALANCED", "Balanced", "3–4 things a day"], ["PACKED", "Packed", "See as much as possible"]] as const).map(([v, l, d]) => (
                    <button key={v} type="button" onClick={() => set("pace", v)} aria-pressed={form.pace === v} className={cn("rounded-lg border p-3 text-left", form.pace === v ? "border-forest bg-sage-soft" : "border-line bg-surface")}>
                      <span className="block text-sm font-medium">{l}</span>
                      <span className="block text-xs text-ink-muted">{d}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Total budget (₹)" htmlFor="budget" error={errors.budget} optional>
                  <Input id="budget" inputMode="decimal" placeholder="20000" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
                </Field>
                <Field label="Getting there" htmlFor="transport">
                  <Select id="transport" value={form.transport} onChange={(e) => set("transport", e.target.value as Transport)}>
                    {(["ROAD_TRIP", "BUS", "TRAIN", "FLIGHT", "MIXED"] as const).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                  </Select>
                </Field>
                <Field label="Stay" htmlFor="acc">
                  <Select id="acc" value={form.accommodation} onChange={(e) => set("accommodation", e.target.value as Accommodation)}>
                    {(["BUDGET", "MIDRANGE", "LUXURY", "HOSTEL", "HOMESTAY", "CAMPING"] as const).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                  </Select>
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Dietary preferences" htmlFor="diet" optional>
                <Input id="diet" placeholder="e.g. vegetarian, no seafood" value={form.dietary} onChange={(e) => set("dietary", e.target.value)} maxLength={200} />
              </Field>
              <Field label="Accessibility needs" htmlFor="access" optional>
                <Textarea id="access" rows={2} placeholder="e.g. traveling with parents, avoid steep climbs" value={form.accessibility} onChange={(e) => set("accessibility", e.target.value)} maxLength={300} />
              </Field>
              <p className="rounded-md bg-surface-muted/70 p-3 text-[13px] text-ink-muted">
                You&apos;ll review the plan before anything is saved. Costs are estimates, and opening hours aren&apos;t verified.
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ArrowLeft /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => validateStep(step) && setStep((s) => s + 1)}>
            Next <ArrowRight />
          </Button>
        ) : (
          <Button variant="accent" onClick={submit} loading={generate.isPending}>
            <Sparkles /> {generate.isPending ? "Planning your days…" : "Generate plan"}
          </Button>
        )}
      </div>
      {status.data && (
        <div className="mt-6 flex justify-center">
          <EngineBadge label={status.data.label} simulated={status.data.simulated} />
        </div>
      )}
    </Card>
  );
}

export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="TravelMate AI planner" description="Tell us how you like to travel. Get a realistic day-by-day plan you can edit." />
      <Suspense>
        <Planner />
      </Suspense>
    </div>
  );
}
