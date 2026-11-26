"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MailWarning } from "lucide-react";
import { useProfile, useProfileStats, useUpdateProfile } from "@/features/profile/hooks";
import { useAuthStore } from "@/lib/auth-store";
import { ErrorState, PageHeader } from "@/components/common/states";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { cn, titleCase } from "@/lib/utils";
import { TRAVEL_STYLES, type ProfileDto, type TravelStyle } from "@/types/api";

const schema = z.object({
  displayName: z.string().trim().min(2, "Use at least 2 characters").max(60),
  avatarUrl: z.union([z.literal(""), z.string().url("Enter a full https:// image URL").startsWith("https://", "Use an https:// URL")]),
  homeCity: z.string().max(80),
  bio: z.string().max(500),
  preferredCurrency: z.string().length(3),
});
type Values = z.infer<typeof schema>;

function ProfileForm({ profile }: { profile: ProfileDto }) {
  const update = useUpdateProfile();
  const [styles, setStyles] = React.useState<TravelStyle[]>(profile.travelStyles);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? "",
      homeCity: profile.homeCity ?? "",
      bio: profile.bio ?? "",
      preferredCurrency: profile.preferredCurrency,
    },
  });
  const { errors, isDirty } = form.formState;
  const stylesDirty = styles.join() !== profile.travelStyles.join();

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={form.handleSubmit((v) =>
        update.mutate(
          { ...v, avatarUrl: v.avatarUrl || null, homeCity: v.homeCity || null, bio: v.bio || null, travelStyles: styles },
          { onSuccess: (p) => { toast.success("Profile saved"); form.reset({ ...v }); setStyles(p.travelStyles); }, onError: (e) => toast.error(errorMessage(e)) },
        ),
      )}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="displayName" error={errors.displayName?.message}>
          <Input id="displayName" {...form.register("displayName")} />
        </Field>
        <Field label="Home city" htmlFor="homeCity" optional>
          <Input id="homeCity" placeholder="Bengaluru" {...form.register("homeCity")} />
        </Field>
      </div>
      <Field label="Avatar image URL" htmlFor="avatarUrl" error={errors.avatarUrl?.message} optional>
        <Input id="avatarUrl" placeholder="https://…" {...form.register("avatarUrl")} />
      </Field>
      <Field label="About you" htmlFor="bio" optional>
        <Textarea id="bio" rows={3} {...form.register("bio")} />
      </Field>
      <Field label="Preferred currency" htmlFor="preferredCurrency">
        <Select id="preferredCurrency" className="w-40" {...form.register("preferredCurrency")}>
          {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <div>
        <p className="mb-2 text-[13px] font-medium">How you like to travel</p>
        <div className="flex flex-wrap gap-2">
          {TRAVEL_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={styles.includes(s)}
              onClick={() => setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))}
              className={cn("rounded-full border px-3 py-1 text-sm", styles.includes(s) ? "border-forest bg-forest text-on-forest" : "border-line text-ink-muted hover:text-ink")}
            >
              {titleCase(s)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">Used as defaults when you plan a new trip.</p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} disabled={!isDirty && !stylesDirty}>Save profile</Button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)!;
  const profile = useProfile();
  const stats = useProfileStats();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="Profile" description={`${user.email} · member since ${formatDate(user.createdAt, { year: "numeric", month: "long", day: undefined })}`} />
      {!user.emailVerified && (
        <p className="mb-6 flex items-center gap-2 rounded-md bg-amber-soft px-4 py-3 text-sm">
          <MailWarning className="size-4 text-amber" aria-hidden /> Your email isn&apos;t verified yet. Check your inbox for the verification link.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <Card className="p-5 sm:p-7">
          {profile.isLoading ? <Skeleton className="h-80" /> : profile.isError ? <ErrorState error={profile.error} onRetry={() => profile.refetch()} /> : profile.data ? <ProfileForm profile={profile.data} /> : null}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="font-display text-base font-semibold">Travel stats</h2>
          {stats.data ? (
            <dl className="mt-4 space-y-3 text-sm">
              {([
                ["Trips planned", stats.data.tripsTotal],
                ["Upcoming", stats.data.tripsUpcoming],
                ["Completed", stats.data.tripsCompleted],
                ["Destinations visited", stats.data.destinationsVisited],
                ["Days traveling", stats.data.totalTravelDays],
                ["Saved places", stats.data.savedPlaces],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-ink-muted">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
              ))}
            </dl>
          ) : (
            <Skeleton className="mt-4 h-40" />
          )}
        </Card>
      </div>
    </div>
  );
}
