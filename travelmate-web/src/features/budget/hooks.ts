"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { BudgetCategory, BudgetDto, ExpenseDto, ExpenseInput } from "@/types/api";

export function useBudget(tripId: string) {
  return useQuery({
    queryKey: qk.budget(tripId),
    queryFn: ({ signal }) => api<BudgetDto>(`/trips/${tripId}/budget`, { signal }),
  });
}

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: qk.expenses(tripId),
    queryFn: ({ signal }) => api<ExpenseDto[]>(`/trips/${tripId}/expenses`, { signal }),
  });
}

function useRefresh(tripId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.budget(tripId) });
    qc.invalidateQueries({ queryKey: qk.expenses(tripId) });
    qc.invalidateQueries({ queryKey: qk.trip(tripId) });
    qc.invalidateQueries({ queryKey: qk.profileStats });
  };
}

export function useUpdateBudget(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: (body: { totalBudget: string | null; categoryBudgets: Partial<Record<BudgetCategory, string>> }) =>
      api<BudgetDto>(`/trips/${tripId}/budget`, { method: "PUT", body }),
    onSuccess: refresh,
  });
}

export function useSaveExpense(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: ({ id, ...body }: ExpenseInput & { id?: string }) =>
      id
        ? api<ExpenseDto>(`/expenses/${id}`, { method: "PUT", body })
        : api<ExpenseDto>(`/trips/${tripId}/expenses`, { method: "POST", body }),
    onSuccess: refresh,
  });
}

export function useDeleteExpense(tripId: string) {
  const refresh = useRefresh(tripId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}
