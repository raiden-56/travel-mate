"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDestinations } from "@/features/destinations/hooks";
import { tripFormSchema, type TripFormOutput, type TripFormValues } from "@/features/trips/schemas";
import { daysBetweenInclusive } from "@/lib/dates";
import { titleCase } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { TRAVEL_STYLES, type TripUpsert } from "@/types/api";

type Props = {
  defaultValues?: Partial<TripFormValues>;
  submitLabel: string;
  pending: boolean;
  onSubmit: (body: TripUpsert) => void;
  serverError?: unknown;
};

export function TripForm({ defaultValues, submitLabel, pending, onSubmit, serverError }: Props) {
  const destinations = useDestinations({ size: 100, sort: "name" });
  const form = useForm<TripFormValues, unknown, TripFormOutput>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: { name: "", destinationName: "", dayCount: 3, travelers: 2, tripType: "", budgetAmount: "", ...defaultValues },
  });
  const { errors } = form.formState;
  const [startDate, endDate, destinationSlug] = form.watch(["startDate", "endDate", "destinationSlug"]);

  // Keep day count in sync with dates when both are set.
  React.useEffect(() => {
    if (startDate && endDate && endDate >= startDate) form.setValue("dayCount", daysBetweenInclusive(startDate, endDate));
  }, [startDate, endDate, form]);

  React.useEffect(() => {
    if (serverError instanceof ApiError) {
      serverError.fieldErrors.forEach((fe) => form.setError(fe.field as keyof TripFormValues, { message: fe.message }));
    }
  }, [serverError, form]);

  const datesSet = !!(startDate && endDate);

  const submit = form.handleSubmit((v) =>
    onSubmit({
      name: v.name,
      destinationSlug: v.destinationSlug || null,
      destinationName: v.destinationName,
      startLocation: v.startLocation || null,
      startDate: v.startDate || null,
      endDate: v.endDate || null,
      dayCount: v.dayCount,
      travelers: v.travelers,
      tripType: v.tripType || null,
      budgetAmount: v.budgetAmount || null,
      currency: "INR",
      description: v.description || null,
    }),
  );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="Trip name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" placeholder="Gokarna long weekend" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Destination" htmlFor="destinationSlug" hint="Pick a destination we cover, or type your own below.">
          <Select
            id="destinationSlug"
            value={destinationSlug ?? ""}
            onChange={(e) => {
              const slug = e.target.value;
              form.setValue("destinationSlug", slug || undefined);
              const d = destinations.data?.items.find((x) => x.slug === slug);
              if (d) {
                form.setValue("destinationName", d.name, { shouldValidate: true });
                if (!form.getValues("name")) form.setValue("name", `${d.name} trip`);
              }
            }}
          >
            <option value="">Somewhere else</option>
            {destinations.data?.items.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}, {d.state}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Destination name" htmlFor="destinationName" error={errors.destinationName?.message}>
          <Input
            id="destinationName"
            aria-invalid={!!errors.destinationName}
            readOnly={!!destinationSlug}
            className={destinationSlug ? "bg-surface-muted" : undefined}
            {...form.register("destinationName")}
          />
        </Field>
      </div>

      <Field label="Starting from" htmlFor="startLocation" optional>
        <Input id="startLocation" placeholder="Bengaluru" {...form.register("startLocation")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Start date" htmlFor="startDate" error={errors.startDate?.message} optional>
          <Input id="startDate" type="date" {...form.register("startDate")} />
        </Field>
        <Field label="End date" htmlFor="endDate" error={errors.endDate?.message} optional>
          <Input id="endDate" type="date" min={startDate} {...form.register("endDate")} />
        </Field>
        <Field label="Days" htmlFor="dayCount" error={errors.dayCount?.message} hint={datesSet ? "Set from your dates" : undefined}>
          <Input id="dayCount" type="number" min={1} max={60} readOnly={datesSet} className={datesSet ? "bg-surface-muted" : undefined} {...form.register("dayCount")} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Travelers" htmlFor="travelers" error={errors.travelers?.message}>
          <Input id="travelers" type="number" min={1} max={50} {...form.register("travelers")} />
        </Field>
        <Field label="Trip style" htmlFor="tripType" optional>
          <Select id="tripType" {...form.register("tripType")}>
            <option value="">Not set</option>
            {TRAVEL_STYLES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Total budget (₹)" htmlFor="budgetAmount" error={errors.budgetAmount?.message} optional>
          <Input id="budgetAmount" inputMode="decimal" placeholder="20000" {...form.register("budgetAmount")} />
        </Field>
      </div>

      <Field label="Notes" htmlFor="description" optional>
        <Textarea id="description" rows={3} placeholder="Anything the group should know" {...form.register("description")} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
