"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { qk } from "@/lib/query-keys";
import type {
  CategoryDto,
  DestinationDetail,
  DestinationSummary,
  FavoriteDto,
  FavoriteTarget,
  PageResponse,
  SearchResult,
  Suggestion,
  WeatherDto,
} from "@/types/api";

export type DestinationFilters = {
  q?: string;
  category?: string;
  budgetMax?: string;
  maxDays?: number;
  featured?: boolean;
  sort?: "featured" | "name" | "budget";
  page?: number;
  size?: number;
};

/** Auth status is part of the key so `saved` flags refresh after login/logout. */
function useAuthKey() {
  return useAuthStore((s) => s.status);
}

export function useDestinations(filters: DestinationFilters) {
  const auth = useAuthKey();
  return useQuery({
    queryKey: [...qk.destinations(filters as Record<string, unknown>), auth],
    queryFn: ({ signal }) =>
      api<PageResponse<DestinationSummary>>("/destinations", { query: { ...filters }, signal }),
    placeholderData: keepPreviousData,
    enabled: auth !== "loading",
  });
}

export function useDestination(slug: string) {
  const auth = useAuthKey();
  return useQuery({
    queryKey: [...qk.destination(slug), auth],
    queryFn: ({ signal }) => api<DestinationDetail>(`/destinations/${slug}`, { signal }),
    enabled: auth !== "loading" && !!slug,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: ({ signal }) => api<CategoryDto[]>("/destinations/categories", { signal }),
    staleTime: 60 * 60_000,
  });
}

export function useNearbyDestinations(coords: { lat: number; lng: number } | null, radiusKm = 400) {
  return useQuery({
    queryKey: qk.nearby(coords?.lat ?? 0, coords?.lng ?? 0, radiusKm),
    queryFn: ({ signal }) =>
      api<(DestinationSummary & { distanceKm: number })[]>("/destinations/nearby", {
        query: { lat: coords!.lat, lng: coords!.lng, radiusKm },
        signal,
      }),
    enabled: !!coords,
  });
}

export function useWeather(slug: string | null | undefined) {
  return useQuery({
    queryKey: qk.weather(slug ?? ""),
    queryFn: ({ signal }) => api<WeatherDto>(`/destinations/${slug}/weather`, { signal }),
    enabled: !!slug,
    staleTime: 15 * 60_000,
    retry: 1,
  });
}

export function useSuggestions(q: string) {
  return useQuery({
    queryKey: qk.suggest(q),
    queryFn: ({ signal }) => api<Suggestion[]>("/search/suggest", { query: { q }, signal }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });
}

export function useSearch(q: string) {
  const auth = useAuthKey();
  return useQuery({
    queryKey: [...qk.search(q), auth],
    queryFn: ({ signal }) => api<SearchResult>("/search", { query: { q }, signal }),
    enabled: q.trim().length >= 2 && auth !== "loading",
  });
}

export function usePopularSearches() {
  return useQuery({
    queryKey: qk.popularSearches,
    queryFn: ({ signal }) => api<string[]>("/search/popular", { signal }),
    staleTime: 60 * 60_000,
  });
}

export function useFavorites(enabled = true) {
  return useQuery({
    queryKey: qk.favorites,
    queryFn: ({ signal }) => api<FavoriteDto[]>("/favorites", { signal }),
    enabled,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { targetType: FavoriteTarget; targetId: string; saved: boolean }) => {
      if (v.saved) {
        await api<void>(`/favorites/${v.targetType}/${v.targetId}`, { method: "DELETE" });
      } else {
        await api<unknown>("/favorites", { method: "POST", body: { targetType: v.targetType, targetId: v.targetId } });
      }
      return !v.saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.favorites });
      qc.invalidateQueries({ queryKey: ["destinations"] });
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: qk.profileStats });
    },
  });
}
