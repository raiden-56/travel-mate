"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type {
  ChecklistCategory,
  ChecklistDto,
  ChecklistItemDto,
  ChecklistSuggestion,
  ChecklistTemplate,
} from "@/types/api";

export function useChecklistTemplates() {
  return useQuery({
    queryKey: qk.checklistTemplates,
    queryFn: ({ signal }) => api<ChecklistTemplate[]>("/checklist-templates", { signal }),
    staleTime: 60 * 60_000,
  });
}

export function useChecklists(tripId: string) {
  return useQuery({
    queryKey: qk.checklists(tripId),
    queryFn: ({ signal }) => api<ChecklistDto[]>(`/trips/${tripId}/checklists`, { signal }),
  });
}

function useRefresh(tripId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.checklists(tripId) });
}

export function useCreateChecklist(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: (body: { name: string; templateKey?: string }) =>
      api<ChecklistDto>(`/trips/${tripId}/checklists`, { method: "POST", body }),
    onSuccess: refresh,
  });
}

export function useDeleteChecklist(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/checklists/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useAddChecklistItem(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: ({
      checklistId,
      ...body
    }: {
      checklistId: string;
      label: string;
      category: ChecklistCategory;
      suggested?: boolean;
      reason?: string;
    }) => api<ChecklistItemDto>(`/checklists/${checklistId}/items`, { method: "POST", body }),
    onSuccess: refresh,
  });
}

/** Optimistic toggle/edit so ticking items feels instant. */
export function useUpdateChecklistItem(tripId: string) {
  const qc = useQueryClient();
  const key = qk.checklists(tripId);
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; label?: string; category?: ChecklistCategory; completed?: boolean }) =>
      api<ChecklistItemDto>(`/checklist-items/${id}`, { method: "PUT", body }),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChecklistDto[]>(key);
      if (previous) {
        qc.setQueryData<ChecklistDto[]>(
          key,
          previous.map((c) => {
            const items = c.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
            return { ...c, items, completedCount: items.filter((i) => i.completed).length };
          }),
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteChecklistItem(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/checklist-items/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useChecklistSuggestions(tripId: string) {
  return useMutation({
    mutationFn: () => api<ChecklistSuggestion>(`/trips/${tripId}/checklists/suggest`, { method: "POST" }),
  });
}
