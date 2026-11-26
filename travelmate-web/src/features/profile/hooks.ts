"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { qk } from "@/lib/query-keys";
import type { ProfileDto, ProfileStats } from "@/types/api";

export function useProfile() {
  return useQuery({ queryKey: qk.profile, queryFn: ({ signal }) => api<ProfileDto>("/profile", { signal }) });
}

export function useProfileStats() {
  return useQuery({
    queryKey: qk.profileStats,
    queryFn: ({ signal }) => api<ProfileStats>("/profile/stats", { signal }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (body: ProfileDto) => api<ProfileDto>("/profile", { method: "PUT", body }),
    onSuccess: (data) => {
      qc.setQueryData(qk.profile, data);
      if (user) setUser({ ...user, displayName: data.displayName, avatarUrl: data.avatarUrl });
    },
  });
}
