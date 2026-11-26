"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowRightCircle, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { TRIP_TRANSITIONS, useDeleteTrip, useTripAction } from "@/features/trips/hooks";
import { errorMessage } from "@/lib/api-client";
import { titleCase } from "@/lib/utils";
import type { TripDto, TripStatus } from "@/types/api";
import { tripHref } from "@/lib/routes";

const transitionLabel: Partial<Record<TripStatus, string>> = {
  UPCOMING: "Mark as upcoming",
  IN_PROGRESS: "Start trip",
  COMPLETED: "Complete trip",
  CANCELLED: "Cancel trip",
  PLANNING: "Back to planning",
};

export function TripActions({ trip }: { trip: TripDto }) {
  const router = useRouter();
  const action = useTripAction(trip.id);
  const del = useDeleteTrip();
  const [confirm, setConfirm] = React.useState<null | "delete" | TripStatus>(null);
  const isOwner = trip.myRole === "OWNER";

  const run = (a: Parameters<typeof action.mutate>[0], success: string, after?: (t: TripDto) => void) =>
    action.mutate(a, {
      onSuccess: (t) => {
        toast.success(success);
        after?.(t);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  const changeStatus = (status: TripStatus) => {
    if (status === "UPCOMING" && !trip.startDate) {
      toast.error("Add travel dates in Settings before marking the trip upcoming.");
      return;
    }
    run({ kind: "status", status }, `Trip is now ${titleCase(status).toLowerCase()}`);
    setConfirm(null);
  };

  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Trip actions">
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent className="w-56">
          <DropdownItem asChild>
            <Link href={tripHref(trip.id, "settings")}>
              <Pencil /> Edit trip details
            </Link>
          </DropdownItem>
          <DropdownItem onSelect={() => run({ kind: "duplicate" }, "Trip duplicated", (t) => router.push(tripHref(t.id)))}>
            <Copy /> Duplicate
          </DropdownItem>
          {TRIP_TRANSITIONS[trip.status].length > 0 && (
            <>
              <DropdownSeparator />
              <DropdownLabel>Status</DropdownLabel>
              {TRIP_TRANSITIONS[trip.status].map((s) => (
                <DropdownItem key={s} onSelect={() => (s === "CANCELLED" ? setConfirm(s) : changeStatus(s))}>
                  <ArrowRightCircle /> {transitionLabel[s]}
                </DropdownItem>
              ))}
            </>
          )}
          <DropdownSeparator />
          {trip.archived ? (
            <DropdownItem onSelect={() => run({ kind: "unarchive" }, "Trip restored")}>
              <ArchiveRestore /> Unarchive
            </DropdownItem>
          ) : (
            <DropdownItem onSelect={() => run({ kind: "archive" }, "Trip archived")}>
              <Archive /> Archive
            </DropdownItem>
          )}
          {isOwner && (
            <DropdownItem destructive onSelect={() => setConfirm("delete")}>
              <Trash2 /> Delete trip
            </DropdownItem>
          )}
        </DropdownContent>
      </Dropdown>

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this trip?"
        description={`“${trip.name}” and its itinerary, budget and checklists will be removed from your trips.`}
        confirmLabel="Delete trip"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(trip.id, {
            onSuccess: () => {
              toast.success("Trip deleted");
              router.push("/trips");
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
      <ConfirmDialog
        open={confirm === "CANCELLED"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Cancel this trip?"
        description="The trip stays in your list as cancelled. You can move it back to planning later."
        confirmLabel="Cancel trip"
        destructive
        loading={action.isPending}
        onConfirm={() => changeStatus("CANCELLED")}
      />
    </>
  );
}
