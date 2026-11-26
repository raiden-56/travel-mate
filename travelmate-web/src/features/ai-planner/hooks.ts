"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { EngineInfo, PlanProposal, PlanRequest, TripDto, TripUpsert } from "@/types/api";

export function useAiStatus() {
  return useQuery({
    queryKey: qk.aiStatus,
    queryFn: ({ signal }) => api<Omit<EngineInfo, "id"> & { engine: EngineInfo["id"] }>("/ai/status", { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useGeneratePlan() {
  return useMutation({
    mutationFn: (body: PlanRequest) => api<PlanProposal>("/ai/trip-planner/generate", { method: "POST", body }),
  });
}

export function useModifyPlan() {
  return useMutation({
    mutationFn: (body: { tripId: string; instruction: string }) =>
      api<PlanProposal>("/ai/trip-planner/modify", { method: "POST", body }),
  });
}

/** Writes a proposal into a trip. Nothing is persisted until the user confirms this. */
export function useApplyProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, ...body }: { proposalId: string; tripId?: string; trip?: TripUpsert }) =>
      api<TripDto>(`/ai/trip-planner/proposals/${proposalId}/apply`, { method: "POST", body }),
    onSuccess: (trip) => {
      qc.setQueryData(qk.trip(trip.id), trip);
      qc.invalidateQueries({ queryKey: qk.tripsAll });
      qc.invalidateQueries({ queryKey: qk.itinerary(trip.id) });
      qc.invalidateQueries({ queryKey: qk.budget(trip.id) });
      qc.invalidateQueries({ queryKey: qk.profileStats });
    },
  });
}
