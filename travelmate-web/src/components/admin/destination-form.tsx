"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { useCategories } from "@/features/destinations/hooks";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { DestinationDetail, DestinationUpsert } from "@/types/api";

const money = z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Amount like 1500");
const httpsUrl = z.string().trim().url("Full URL").startsWith("https://", "Use https://");

const schema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase words separated by hyphens"),
    region: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(120),
    country: z.string().trim().min(2).max(120),
    summary: z.string().trim().min(20, "At least a sentence").max(300),
    description: z.string().trim().min(50, "Write a few sentences").max(10000),
    heroImageUrl: z.union([z.literal(""), httpsUrl]),
    heroImageCredit: z.string().max(200),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    categorySlugs: z.array(z.string()).min(1, "Pick at least one category"),
    recommendedDaysMin: z.coerce.number().int().min(1).max(30),
    recommendedDaysMax: z.coerce.number().int().min(1).max(30),
    budgetPerDayMin: money,
    budgetPerDayMax: money,
    bestTimeToVisit: z.string().trim().min(3).max(300),
    howToReach: z.string().trim().min(10).max(3000),
    localTransport: z.string().trim().min(10).max(2000),
    travelTips: z.string().max(4000),
    safetyInfo: z.string().trim().min(10).max(2000),
    faqs: z.array(z.object({ question: z.string().trim().min(5).max(200), answer: z.string().trim().min(5).max(1000) })),
    gallery: z.array(z.object({ url: httpsUrl, credit: z.string().max(200), alt: z.string().trim().min(3).max(200) })),
    featured: z.boolean(),
    seoTitle: z.string().max(70),
    seoDescription: z.string().max(170),
  })
  .refine((v) => v.recommendedDaysMax >= v.recommendedDaysMin, { path: ["recommendedDaysMax"], message: "Must be ≥ min" })
  .refine((v) => Number(v.budgetPerDayMax) >= Number(v.budgetPerDayMin), { path: ["budgetPerDayMax"], message: "Must be ≥ min" });

type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

function toValues(d?: DestinationDetail | null): Values {
  return {
    name: d?.name ?? "",
    slug: d?.slug ?? "",
    region: d?.region ?? "",
    state: d?.state ?? "Karnataka",
    country: d?.country ?? "India",
    summary: d?.summary ?? "",
    description: d?.description ?? "",
    heroImageUrl: d?.heroImageUrl ?? "",
    heroImageCredit: d?.heroImageCredit ?? "",
    latitude: d?.latitude ?? ("" as unknown as number),
    longitude: d?.longitude ?? ("" as unknown as number),
    categorySlugs: d?.categories.map((c) => c.slug) ?? [],
    recommendedDaysMin: d?.recommendedDaysMin ?? 2,
    recommendedDaysMax: d?.recommendedDaysMax ?? 3,
    budgetPerDayMin: d?.budgetPerDayMin ?? "",
    budgetPerDayMax: d?.budgetPerDayMax ?? "",
    bestTimeToVisit: d?.bestTimeToVisit ?? "",
    howToReach: d?.howToReach ?? "",
    localTransport: d?.localTransport ?? "",
    travelTips: d?.travelTips.join("\n") ?? "",
    safetyInfo: d?.safetyInfo ?? "",
    faqs: d?.faqs ?? [],
    gallery: d?.gallery.map((g) => ({ ...g, credit: g.credit ?? "" })) ?? [],
    featured: d?.featured ?? false,
    seoTitle: d?.seoTitle ?? "",
    seoDescription: d?.seoDescription ?? "",
  };
}

export function DestinationForm({
  destination,
  pending,
  serverError,
  onSubmit,
}: {
  destination?: DestinationDetail | null;
  pending: boolean;
  serverError?: unknown;
  onSubmit: (body: DestinationUpsert) => void;
}) {
  const categories = useCategories();
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(schema), defaultValues: toValues(destination) });
  const faqs = useFieldArray({ control: form.control, name: "faqs" });
  const gallery = useFieldArray({ control: form.control, name: "gallery" });
  const { errors } = form.formState;
  const selected = form.watch("categorySlugs");

  React.useEffect(() => {
    if (serverError instanceof ApiError) serverError.fieldErrors.forEach((fe) => form.setError(fe.field as keyof Values, { message: fe.message }));
  }, [serverError, form]);

  const submit = form.handleSubmit((v) =>
    onSubmit({
      ...v,
      currency: "INR",
      heroImageUrl: v.heroImageUrl || null,
      heroImageCredit: v.heroImageCredit || null,
      travelTips: v.travelTips.split("\n").map((t) => t.trim()).filter(Boolean),
      gallery: v.gallery.map((g) => ({ ...g, credit: g.credit || null })),
      seoTitle: v.seoTitle || null,
      seoDescription: v.seoDescription || null,
    }),
  );

  const section = "space-y-4 p-5 sm:p-6";
  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card className={section}>
        <h2 className="font-display text-base font-semibold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name?.message}><Input id="name" {...form.register("name")} /></Field>
          <Field label="URL slug" htmlFor="slug" error={errors.slug?.message} hint="/destinations/your-slug"><Input id="slug" {...form.register("slug")} /></Field>
          <Field label="Region" htmlFor="region" error={errors.region?.message}><Input id="region" placeholder="Uttara Kannada" {...form.register("region")} /></Field>
          <Field label="State" htmlFor="state" error={errors.state?.message}><Input id="state" {...form.register("state")} /></Field>
          <Field label="Country" htmlFor="country" error={errors.country?.message}><Input id="country" {...form.register("country")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="lat" error={errors.latitude?.message}><Input id="lat" inputMode="decimal" {...form.register("latitude")} /></Field>
            <Field label="Longitude" htmlFor="lng" error={errors.longitude?.message}><Input id="lng" inputMode="decimal" {...form.register("longitude")} /></Field>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.data?.map((c) => {
              const on = selected.includes(c.slug);
              return (
                <button
                  type="button"
                  key={c.slug}
                  aria-pressed={on}
                  onClick={() => form.setValue("categorySlugs", on ? selected.filter((s) => s !== c.slug) : [...selected, c.slug], { shouldValidate: true, shouldDirty: true })}
                  className={cn("rounded-full border px-3 py-1 text-[13px]", on ? "border-forest bg-forest text-on-forest" : "border-line text-ink-muted")}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          {errors.categorySlugs && <p className="mt-1 text-xs text-danger">{errors.categorySlugs.message}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--sage)]" {...form.register("featured")} /> Featured on the home page</label>
      </Card>

      <Card className={section}>
        <h2 className="font-display text-base font-semibold">Content</h2>
        <Field label="Summary" htmlFor="summary" error={errors.summary?.message} hint="One or two sentences for cards and search."><Textarea id="summary" rows={2} {...form.register("summary")} /></Field>
        <Field label="Description" htmlFor="description" error={errors.description?.message} hint="Separate paragraphs with a blank line."><Textarea id="description" rows={8} {...form.register("description")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Best time to visit" htmlFor="best" error={errors.bestTimeToVisit?.message}><Input id="best" {...form.register("bestTimeToVisit")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min days" htmlFor="dmin" error={errors.recommendedDaysMin?.message}><Input id="dmin" type="number" {...form.register("recommendedDaysMin")} /></Field>
            <Field label="Max days" htmlFor="dmax" error={errors.recommendedDaysMax?.message}><Input id="dmax" type="number" {...form.register("recommendedDaysMax")} /></Field>
          </div>
          <Field label="Budget/day min (₹, est.)" htmlFor="bmin" error={errors.budgetPerDayMin?.message}><Input id="bmin" inputMode="decimal" {...form.register("budgetPerDayMin")} /></Field>
          <Field label="Budget/day max (₹, est.)" htmlFor="bmax" error={errors.budgetPerDayMax?.message}><Input id="bmax" inputMode="decimal" {...form.register("budgetPerDayMax")} /></Field>
        </div>
        <Field label="How to reach" htmlFor="reach" error={errors.howToReach?.message}><Textarea id="reach" rows={4} {...form.register("howToReach")} /></Field>
        <Field label="Getting around" htmlFor="local" error={errors.localTransport?.message}><Textarea id="local" rows={3} {...form.register("localTransport")} /></Field>
        <Field label="Travel tips" htmlFor="tips" hint="One tip per line." optional><Textarea id="tips" rows={4} {...form.register("travelTips")} /></Field>
        <Field label="Safety" htmlFor="safety" error={errors.safetyInfo?.message}><Textarea id="safety" rows={3} {...form.register("safetyInfo")} /></Field>
      </Card>

      <Card className={section}>
        <h2 className="font-display text-base font-semibold">Images</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hero image URL" htmlFor="hero" error={errors.heroImageUrl?.message} hint="Allowed hosts: Wikimedia, Unsplash." optional><Input id="hero" {...form.register("heroImageUrl")} /></Field>
          <Field label="Hero credit" htmlFor="heroc" optional><Input id="heroc" placeholder="Wikimedia Commons" {...form.register("heroImageCredit")} /></Field>
        </div>
        <div className="space-y-3">
          {gallery.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Input aria-label="Image URL" placeholder="https://…" {...form.register(`gallery.${i}.url`)} aria-invalid={!!errors.gallery?.[i]?.url} />
              <Input aria-label="Alt text" placeholder="Describe the photo" {...form.register(`gallery.${i}.alt`)} aria-invalid={!!errors.gallery?.[i]?.alt} />
              <Input aria-label="Credit" placeholder="Credit" {...form.register(`gallery.${i}.credit`)} />
              <Button type="button" variant="ghost" size="icon" onClick={() => gallery.remove(i)} aria-label="Remove image"><X /></Button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => gallery.append({ url: "", alt: "", credit: "" })}><Plus /> Add gallery image</Button>
        </div>
      </Card>

      <Card className={section}>
        <h2 className="font-display text-base font-semibold">FAQs</h2>
        {faqs.fields.map((f, i) => (
          <div key={f.id} className="space-y-2 rounded-md border border-line p-3">
            <div className="flex gap-2">
              <Input aria-label="Question" placeholder="Question" {...form.register(`faqs.${i}.question`)} aria-invalid={!!errors.faqs?.[i]?.question} />
              <Button type="button" variant="ghost" size="icon" onClick={() => faqs.remove(i)} aria-label="Remove FAQ"><X /></Button>
            </div>
            <Textarea aria-label="Answer" rows={2} placeholder="Answer" {...form.register(`faqs.${i}.answer`)} aria-invalid={!!errors.faqs?.[i]?.answer} />
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => faqs.append({ question: "", answer: "" })}><Plus /> Add FAQ</Button>
      </Card>

      <Card className={section}>
        <h2 className="font-display text-base font-semibold">Search engines</h2>
        <Field label="SEO title" htmlFor="seot" hint="Up to 70 characters. Defaults to “<Name> travel guide…”" optional><Input id="seot" {...form.register("seoTitle")} /></Field>
        <Field label="SEO description" htmlFor="seod" hint="Up to 170 characters. Defaults to the summary." optional><Textarea id="seod" rows={2} {...form.register("seoDescription")} /></Field>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        {Object.keys(errors).length > 0 && <p className="mr-auto self-center text-sm text-danger">Fix the highlighted fields.</p>}
        <Button type="submit" loading={pending}>{destination ? "Save changes" : "Create draft"}</Button>
      </div>
    </form>
  );
}
