"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { TripDto, TripStatus, TripUpsert } from "@/types/api";

export function useTrips(params: { status?: TripStatus; archived?: boolean } = {}) {
  return useQuery({
    queryKey: qk.trips(params),
    queryFn: ({ signal }) => api<TripDto[]>("/trips", { query: params, signal }),
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: qk.trip(id),
    queryFn: ({ signal }) => api<TripDto>(`/trips/${id}`, { signal }),
    enabled: !!id,
  });
}

function useTripInvalidation() {
  const qc = useQueryClient();
  return (trip?: TripDto) => {
    if (trip) qc.setQueryData(qk.trip(trip.id), trip);
    qc.invalidateQueries({ queryKey: qk.tripsAll });
    qc.invalidateQueries({ queryKey: qk.profileStats });
  };
}

export function useCreateTrip() {
  const invalidate = useTripInvalidation();
  return useMutation({
    mutationFn: (body: TripUpsert) => api<TripDto>("/trips", { method: "POST", body }),
    onSuccess: (trip) => invalidate(trip),
  });
}

export function useUpdateTrip(id: string) {
  const invalidate = useTripInvalidation();
  return useMutation({
    mutationFn: (body: TripUpsert) => api<TripDto>(`/trips/${id}`, { method: "PUT", body }),
    onSuccess: (trip) => invalidate(trip),
  });
}

export function useTripAction(id: string) {
  const invalidate = useTripInvalidation();
  return useMutation({
    mutationFn: (
      action: { kind: "status"; status: TripStatus } | { kind: "archive" } | { kind: "unarchive" } | { kind: "duplicate" },
    ) => {
      switch (action.kind) {
        case "status":
          return api<TripDto>(`/trips/${id}/status`, { method: "POST", body: { status: action.status } });
        case "archive":
          return api<TripDto>(`/trips/${id}/archive`, { method: "POST" });
        case "unarchive":
          return api<TripDto>(`/trips/${id}/unarchive`, { method: "POST" });
        case "duplicate":
          return api<TripDto>(`/trips/${id}/duplicate`, { method: "POST" });
      }
    },
    onSuccess: (trip, action) => invalidate(action.kind === "duplicate" ? undefined : trip),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/trips/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.trip(id) });
      qc.invalidateQueries({ queryKey: qk.tripsAll });
      qc.invalidateQueries({ queryKey: qk.profileStats });
    },
  });
}

/** Allowed transitions mirror the backend state machine (docs/API.md). */
export const TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  PLANNING: ["UPCOMING", "CANCELLED"],
  UPCOMING: ["IN_PROGRESS", "PLANNING", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["PLANNING"],
};
