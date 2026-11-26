"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { LatLng, OptimizeResult, RouteResult } from "@/types/api";

export function useRoute(points: LatLng[]) {
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  return useQuery({
    queryKey: qk.route(key),
    queryFn: ({ signal }) => api<RouteResult>("/maps/route", { method: "POST", body: { points }, signal }),
    enabled: points.length >= 2 && points.length <= 25,
    staleTime: 30 * 60_000,
    retry: 0,
  });
}

export function useOptimizeRoute() {
  return useMutation({
    mutationFn: (body: { points: LatLng[]; keepFirst: boolean; keepLast: boolean }) =>
      api<OptimizeResult>("/maps/optimize", { method: "POST", body }),
  });
}
