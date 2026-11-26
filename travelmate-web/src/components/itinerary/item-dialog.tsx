"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAddItem, useUpdateItem } from "@/features/itinerary/hooks";
import { errorMessage, ApiError } from "@/lib/api-client";
import { titleCase } from "@/lib/utils";
import { ITEM_CATEGORIES, ITEM_STATUSES, type AttractionDto, type ItineraryItemDto } from "@/types/api";

const optionalNumber = (min: number, max: number) =>
  z.union([z.literal(""), z.coerce.number().min(min).max(max)]).optional();

const schema = z
  .object({
    title: z.string().trim().min(1, "Add a title").max(160),
    category: z.enum(ITEM_CATEGORIES),
    status: z.enum(ITEM_STATUSES),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
    dayNumber: z.coerce.number().int().min(1),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    durationMinutes: optionalNumber(1, 1440),
    locationName: z.string().trim().max(200).optional(),
    latitude: optionalNumber(-90, 90),
    longitude: optionalNumber(-180, 180),
    estimatedCost: z.union([z.literal(""), z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 500 or 499.50")]).optional(),
    notes: z.string().max(2000).optional(),
    bookingReference: z.string().max(120).optional(),
    locked: z.boolean(),
    attractionId: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.startTime && v.endTime && v.endTime <= v.startTime)
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after the start" });
    const hasLat = v.latitude !== "" && v.latitude != null;
    const hasLng = v.longitude !== "" && v.longitude != null;
    if (hasLat !== hasLng) ctx.addIssue({ code: "custom", path: ["longitude"], message: "Add both latitude and longitude, or neither" });
  });

type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

type Props = {
  tripId: string;
  dayCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ItineraryItemDto | null;
  defaultDay?: number;
  attractions?: AttractionDto[];
};

function toValues(item: ItineraryItemDto | null | undefined, day: number): Values {
  return {
    title: item?.title ?? "",
    category: item?.category ?? "ATTRACTION",
    status: item?.status ?? "PLANNED",
    priority: item?.priority ?? "MEDIUM",
    dayNumber: item?.dayNumber ?? day,
    startTime: item?.startTime ?? "",
    endTime: item?.endTime ?? "",
    durationMinutes: item?.durationMinutes ?? "",
    locationName: item?.locationName ?? "",
    latitude: item?.latitude ?? "",
    longitude: item?.longitude ?? "",
    estimatedCost: item?.estimatedCost ?? "",
    notes: item?.notes ?? "",
    bookingReference: item?.bookingReference ?? "",
    locked: item?.locked ?? false,
    attractionId: item?.attractionId ?? null,
  };
}

export function ItemDialog({ tripId, dayCount, open, onOpenChange, item, defaultDay = 1, attractions = [] }: Props) {
  const add = useAddItem(tripId);
  const update = useUpdateItem(tripId);
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(schema), defaultValues: toValues(item, defaultDay) });
  const { errors } = form.formState;

  React.useEffect(() => {
    if (open) form.reset(toValues(item, defaultDay));
  }, [open, item, defaultDay, form]);

  const pickAttraction = (id: string) => {
    const a = attractions.find((x) => x.id === id);
    if (!a) return;
    form.setValue("attractionId", a.id);
    form.setValue("title", a.name, { shouldValidate: true });
    form.setValue("category", a.category === "RESTAURANT" || a.category === "CAFE" ? "RESTAURANT" : a.category === "ADVENTURE" ? "ACTIVITY" : "ATTRACTION");
    form.setValue("locationName", a.name);
    form.setValue("latitude", a.latitude);
    form.setValue("longitude", a.longitude);
    form.setValue("durationMinutes", a.typicalDurationMinutes);
    if (a.costMax !== "0.00") form.setValue("estimatedCost", a.costMax);
  };

  const submit = form.handleSubmit((v) => {
    const num = (x: number | "" | undefined) => (x === "" || x == null ? null : x);
    const body = {
      title: v.title,
      category: v.category,
      status: v.status,
      priority: v.priority,
      dayNumber: v.dayNumber,
      startTime: v.startTime || null,
      endTime: v.endTime || null,
      durationMinutes: num(v.durationMinutes),
      locationName: v.locationName || null,
      latitude: num(v.latitude),
      longitude: num(v.longitude),
      estimatedCost: v.estimatedCost || null,
      currency: "INR",
      notes: v.notes || null,
      bookingReference: v.bookingReference || null,
      locked: v.locked,
      attractionId: v.attractionId ?? null,
    };
    const opts = {
      onSuccess: () => {
        toast.success(item ? "Activity updated" : "Activity added");
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        if (e instanceof ApiError && e.code === "CONFLICT") toast.error("Someone changed this activity. Reload to see the latest version.");
        else toast.error(errorMessage(e));
      },
    };
    if (item) update.mutate({ id: item.id, ...body, version: item.version }, opts);
    else add.mutate(body, opts);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={item ? "Edit activity" : "Add activity"} variant="sheet">
        <form onSubmit={submit} className="space-y-4" noValidate>
          {!item && attractions.length > 0 && (
            <Field label="Start from a known place" htmlFor="pick" optional hint="Fills in location, duration and a typical cost estimate.">
              <Select id="pick" defaultValue="" onChange={(e) => pickAttraction(e.target.value)}>
                <option value="">Choose a place…</option>
                {attractions.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Title" htmlFor="title" error={errors.title?.message}>
            <Input id="title" aria-invalid={!!errors.title} {...form.register("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day" htmlFor="dayNumber">
              <Select id="dayNumber" {...form.register("dayNumber")}>
                {Array.from({ length: dayCount }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Day {i + 1}</option>
                ))}
              </Select>
            </Field>
            <Field label="Category" htmlFor="category">
              <Select id="category" {...form.register("category")}>
                {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start" htmlFor="startTime" optional>
              <Input id="startTime" type="time" {...form.register("startTime")} />
            </Field>
            <Field label="End" htmlFor="endTime" error={errors.endTime?.message} optional>
              <Input id="endTime" type="time" {...form.register("endTime")} />
            </Field>
            <Field label="Minutes" htmlFor="durationMinutes" error={errors.durationMinutes?.message} optional>
              <Input id="durationMinutes" type="number" min={1} {...form.register("durationMinutes")} />
            </Field>
          </div>
          <Field label="Location" htmlFor="locationName" optional>
            <Input id="locationName" {...form.register("locationName")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="latitude" error={errors.latitude?.message} optional>
              <Input id="latitude" inputMode="decimal" {...form.register("latitude")} />
            </Field>
            <Field label="Longitude" htmlFor="longitude" error={errors.longitude?.message} optional>
              <Input id="longitude" inputMode="decimal" {...form.register("longitude")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost (₹, total)" htmlFor="estimatedCost" error={errors.estimatedCost?.message} optional>
              <Input id="estimatedCost" inputMode="decimal" {...form.register("estimatedCost")} />
            </Field>
            <Field label="Booking ref." htmlFor="bookingReference" optional>
              <Input id="bookingReference" {...form.register("bookingReference")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" htmlFor="status">
              <Select id="status" {...form.register("status")}>
                {ITEM_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="priority">
              <Select id="priority" {...form.register("priority")}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes" optional>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </Field>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--sage)]" {...form.register("locked")} />
            <span>
              <span className="font-medium">Keep this activity</span>
              <span className="block text-xs text-ink-muted">The planner won&apos;t remove or move it when you ask for changes.</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={add.isPending || update.isPending}>{item ? "Save changes" : "Add activity"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
