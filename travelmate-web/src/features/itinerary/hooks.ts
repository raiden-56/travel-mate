"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { ItineraryDto, ItineraryItemDto, ItineraryItemInput } from "@/types/api";

export function useItinerary(tripId: string) {
  return useQuery({
    queryKey: qk.itinerary(tripId),
    queryFn: ({ signal }) => api<ItineraryDto>(`/trips/${tripId}/itinerary`, { signal }),
    enabled: !!tripId,
  });
}

function useRefresh(tripId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.itinerary(tripId) });
    qc.invalidateQueries({ queryKey: qk.trip(tripId) });
    qc.invalidateQueries({ queryKey: qk.budget(tripId) });
  };
}

export function useAddItem(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: (body: ItineraryItemInput) =>
      api<ItineraryItemDto>(`/trips/${tripId}/itinerary`, { method: "POST", body }),
    onSuccess: refresh,
  });
}

export function useUpdateItem(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: ({ id, ...body }: ItineraryItemInput & { id: string }) =>
      api<ItineraryItemDto>(`/itinerary/${id}`, { method: "PUT", body }),
    onSuccess: refresh,
  });
}

export function useDeleteItem(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/itinerary/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useDuplicateItem(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: (id: string) => api<ItineraryItemDto>(`/itinerary/${id}/duplicate`, { method: "POST" }),
    onSuccess: refresh,
  });
}

/**
 * Persists a full day/item ordering. Applies the new order optimistically so drag-and-drop
 * feels instant, and rolls back if the server rejects it.
 */
export function useReorderItinerary(tripId: string) {
  const qc = useQueryClient();
  const key = qk.itinerary(tripId);
  return useMutation({
    mutationFn: (days: { dayNumber: number; itemIds: string[] }[]) =>
      api<ItineraryDto>(`/trips/${tripId}/itinerary/order`, { method: "PUT", body: { days } }),
    onMutate: async (days) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ItineraryDto>(key);
      if (previous) {
        const byId = new Map(previous.days.flatMap((d) => d.items).map((i) => [i.id, i]));
        qc.setQueryData<ItineraryDto>(key, {
          ...previous,
          days: previous.days.map((d) => {
            const order = days.find((x) => x.dayNumber === d.dayNumber);
            if (!order) return d;
            return {
              ...d,
              items: order.itemIds
                .map((id, position) => {
                  const it = byId.get(id);
                  return it ? { ...it, dayNumber: d.dayNumber, position } : null;
                })
                .filter((x): x is ItineraryItemDto => x !== null),
            };
          }),
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });
}
