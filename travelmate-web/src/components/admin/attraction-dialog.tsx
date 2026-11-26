"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSaveAttraction } from "@/features/admin/hooks";
import { ApiError, errorMessage } from "@/lib/api-client";
import { titleCase } from "@/lib/utils";
import { ATTRACTION_CATEGORIES, type AttractionDto } from "@/types/api";

const money = z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Amount like 0 or 250");
const schema = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase words separated by hyphens"),
    category: z.enum(ATTRACTION_CATEGORIES as [string, ...string[]]),
    description: z.string().trim().min(10, "Add a short description").max(2000),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    typicalDurationMinutes: z.coerce.number().int().min(5).max(1440),
    costMin: money,
    costMax: money,
    costNote: z.string().max(300),
    bestTimeOfDay: z.enum(["MORNING", "AFTERNOON", "EVENING", "ANY"]),
    openingHoursNote: z.string().max(300),
    openingHoursVerified: z.boolean(),
    tags: z.string().max(300),
    familyFriendly: z.boolean(),
    accessibilityNote: z.string().max(300),
  })
  .refine((v) => Number(v.costMax) >= Number(v.costMin), { path: ["costMax"], message: "Max must be at least the min" });
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function AttractionDialog({ destinationId, attraction, open, onOpenChange }: { destinationId: string; attraction: AttractionDto | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const save = useSaveAttraction(destinationId);
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;

  React.useEffect(() => {
    if (!open) return;
    const a = attraction;
    form.reset({
      name: a?.name ?? "",
      slug: a?.slug ?? "",
      category: a?.category ?? "OTHER",
      description: a?.description ?? "",
      latitude: a?.latitude ?? ("" as unknown as number),
      longitude: a?.longitude ?? ("" as unknown as number),
      typicalDurationMinutes: a?.typicalDurationMinutes ?? 60,
      costMin: a?.costMin ?? "0",
      costMax: a?.costMax ?? "0",
      costNote: a?.costNote ?? "",
      bestTimeOfDay: a?.bestTimeOfDay ?? "ANY",
      openingHoursNote: a?.openingHoursNote ?? "",
      openingHoursVerified: a?.openingHoursVerified ?? false,
      tags: a?.tags.join(", ") ?? "",
      familyFriendly: a?.familyFriendly ?? false,
      accessibilityNote: a?.accessibilityNote ?? "",
    });
  }, [open, attraction, form]);

  const submit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: attraction?.id,
        body: {
          ...v,
          category: v.category as AttractionDto["category"],
          currency: "INR",
          costNote: v.costNote || null,
          openingHoursNote: v.openingHoursNote || null,
          accessibilityNote: v.accessibilityNote || null,
          tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
        },
      },
      {
        onSuccess: () => { toast.success(attraction ? "Place updated" : "Place added"); onOpenChange(false); },
        onError: (e) => {
          if (e instanceof ApiError) e.fieldErrors.forEach((fe) => form.setError(fe.field as keyof Values, { message: fe.message }));
          toast.error(errorMessage(e));
        },
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={attraction ? `Edit ${attraction.name}` : "Add place"} variant="sheet">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="a-name" error={errors.name?.message}>
            <Input id="a-name" {...form.register("name", { onBlur: (e) => !form.getValues("slug") && form.setValue("slug", slugify(e.target.value)) })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug" htmlFor="a-slug" error={errors.slug?.message}><Input id="a-slug" {...form.register("slug")} /></Field>
            <Field label="Category" htmlFor="a-cat">
              <Select id="a-cat" {...form.register("category")}>{ATTRACTION_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="a-desc" error={errors.description?.message}><Textarea id="a-desc" rows={3} {...form.register("description")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="a-lat" error={errors.latitude?.message}><Input id="a-lat" inputMode="decimal" {...form.register("latitude")} /></Field>
            <Field label="Longitude" htmlFor="a-lng" error={errors.longitude?.message}><Input id="a-lng" inputMode="decimal" {...form.register("longitude")} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Minutes" htmlFor="a-dur" error={errors.typicalDurationMinutes?.message}><Input id="a-dur" type="number" {...form.register("typicalDurationMinutes")} /></Field>
            <Field label="Cost min ₹" htmlFor="a-cmin" error={errors.costMin?.message}><Input id="a-cmin" inputMode="decimal" {...form.register("costMin")} /></Field>
            <Field label="Cost max ₹" htmlFor="a-cmax" error={errors.costMax?.message}><Input id="a-cmax" inputMode="decimal" {...form.register("costMax")} /></Field>
          </div>
          <Field label="Cost note" htmlFor="a-cnote" optional><Input id="a-cnote" placeholder="Entry fee per person; parking extra" {...form.register("costNote")} /></Field>
          <Field label="Best time of day" htmlFor="a-best">
            <Select id="a-best" {...form.register("bestTimeOfDay")}>{["ANY", "MORNING", "AFTERNOON", "EVENING"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>
          </Field>
          <Field label="Opening hours note" htmlFor="a-hours" optional><Input id="a-hours" {...form.register("openingHoursNote")} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--sage)]" {...form.register("openingHoursVerified")} /> Hours verified with an official source</label>
          <Field label="Tags" htmlFor="a-tags" hint="Comma-separated, e.g. sunset, swimming" optional><Input id="a-tags" {...form.register("tags")} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--sage)]" {...form.register("familyFriendly")} /> Family-friendly</label>
          <Field label="Accessibility note" htmlFor="a-access" optional><Input id="a-access" {...form.register("accessibilityNote")} /></Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{attraction ? "Save" : "Add place"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
