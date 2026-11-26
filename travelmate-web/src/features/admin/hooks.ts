"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type {
  AdminDestinationRow,
  AdminStats,
  AdminUserRow,
  AttractionDto,
  AttractionUpsert,
  AuditLogRow,
  DestinationDetail,
  DestinationUpsert,
  PageResponse,
  UserDto,
} from "@/types/api";

export function useAdminStats() {
  return useQuery({ queryKey: qk.admin.stats, queryFn: ({ signal }) => api<AdminStats>("/admin/stats", { signal }) });
}

export function useAdminDestinations(params: { q?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: qk.admin.destinations(params),
    queryFn: ({ signal }) =>
      api<PageResponse<AdminDestinationRow>>("/admin/destinations", { query: { ...params, size: 20 }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminDestination(id: string | null) {
  return useQuery({
    queryKey: qk.admin.destination(id ?? "new"),
    queryFn: ({ signal }) => api<DestinationDetail>(`/admin/destinations/${id}`, { signal }),
    enabled: !!id,
  });
}

function useAdminRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["destinations"] });
  };
}

export function useSaveDestination() {
  const refresh = useAdminRefresh();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: DestinationUpsert }) =>
      id
        ? api<DestinationDetail>(`/admin/destinations/${id}`, { method: "PUT", body })
        : api<DestinationDetail>("/admin/destinations", { method: "POST", body }),
    onSuccess: refresh,
  });
}

export function useDestinationAction() {
  const refresh = useAdminRefresh();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "publish" | "unpublish" | "delete" }): Promise<DestinationDetail | null> => {
      if (action === "delete") {
        await api<void>(`/admin/destinations/${id}`, { method: "DELETE" });
        return null;
      }
      return api<DestinationDetail>(`/admin/destinations/${id}/${action}`, { method: "POST" });
    },
    onSuccess: refresh,
  });
}

export function useSaveAttraction(destinationId: string) {
  const refresh = useAdminRefresh();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: AttractionUpsert }) =>
      id
        ? api<AttractionDto>(`/admin/attractions/${id}`, { method: "PUT", body })
        : api<AttractionDto>(`/admin/destinations/${destinationId}/attractions`, { method: "POST", body }),
    onSuccess: refresh,
  });
}

export function useDeleteAttraction() {
  const refresh = useAdminRefresh();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/attractions/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useAdminUsers(params: { q?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: qk.admin.users(params),
    queryFn: ({ signal }) => api<PageResponse<AdminUserRow>>("/admin/users", { query: { ...params, size: 20 }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useUserAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "suspend" | "reactivate"; reason: string }) =>
      api<UserDto>(`/admin/users/${id}/${action}`, { method: "POST", body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useAuditLogs(page: number) {
  return useQuery({
    queryKey: qk.admin.audit(page),
    queryFn: ({ signal }) => api<PageResponse<AuditLogRow>>("/admin/audit-logs", { query: { page, size: 30 }, signal }),
    placeholderData: keepPreviousData,
  });
}
