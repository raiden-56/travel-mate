"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useTrip, useUpdateTrip } from "@/features/trips/hooks";
import { TripForm } from "@/components/trips/trip-form";
import { ApiError, errorMessage } from "@/lib/api-client";

export default function TripSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const trip = useTrip(id);
  const update = useUpdateTrip(id);
  const t = trip.data!;

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 font-display text-xl font-semibold">Trip details</h2>
      <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-8">
        <TripForm
          key={t.version}
          submitLabel="Save changes"
          pending={update.isPending}
          serverError={update.error}
          defaultValues={{
            name: t.name,
            destinationSlug: t.destination?.slug,
            destinationName: t.destinationName,
            startLocation: t.startLocation ?? "",
            startDate: t.startDate ?? "",
            endDate: t.endDate ?? "",
            dayCount: t.dayCount,
            travelers: t.travelers,
            tripType: t.tripType ?? "",
            budgetAmount: t.budgetAmount ?? "",
            description: t.description ?? "",
          }}
          onSubmit={(body) =>
            update.mutate(
              { ...body, version: t.version, visibility: t.visibility, coverImageUrl: t.coverImageUrl },
              {
                onSuccess: () => toast.success("Trip updated"),
                onError: (e) => {
                  if (e instanceof ApiError && e.code === "CONFLICT") {
                    toast.error("This trip was changed elsewhere. Reloaded the latest version — please re-apply your edits.");
                    trip.refetch();
                  } else toast.error(errorMessage(e));
                },
              },
            )
          }
        />
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Shortening the trip doesn&apos;t delete activities on removed days — they&apos;ll be flagged in the itinerary so you can move them.
      </p>
    </div>
  );
}
