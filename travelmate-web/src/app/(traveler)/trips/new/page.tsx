"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/states";
import { TripForm } from "@/components/trips/trip-form";
import { useCreateTrip } from "@/features/trips/hooks";
import { useDestination } from "@/features/destinations/hooks";
import { errorMessage } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/misc";
import { tripHref } from "@/lib/routes";

function NewTrip() {
  const router = useRouter();
  const slug = useSearchParams().get("destination") ?? "";
  const destination = useDestination(slug);
  const create = useCreateTrip();

  if (slug && destination.isLoading) return <Skeleton className="h-96" />;

  const d = destination.data;
  return (
    <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-8">
      <TripForm
        submitLabel="Create trip"
        pending={create.isPending}
        serverError={create.error}
        defaultValues={
          d ? { destinationSlug: d.slug, destinationName: d.name, name: `${d.name} trip`, dayCount: d.recommendedDaysMin } : undefined
        }
        onSubmit={(body) =>
          create.mutate(body, {
            onSuccess: (trip) => {
              toast.success("Trip created");
              router.push(tripHref(trip.id, "itinerary"));
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  );
}

export default function NewTripPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title="New trip"
        description="Start with the basics. You can add the plan yourself or let the planner draft it."
        actions={
          <Link href="/planner" className="flex items-center gap-1.5 text-sm font-medium text-sage hover:underline">
            <Sparkles className="size-4" /> Use the planner instead
          </Link>
        }
      />
      <Suspense>
        <NewTrip />
      </Suspense>
    </div>
  );
}
