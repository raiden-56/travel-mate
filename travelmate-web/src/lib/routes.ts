"use client";

import { useParams, useSearchParams } from "next/navigation";
import { IS_DEMO } from "@/demo/config";

/**
 * Trip and admin-destination URLs. The server build uses path segments (/trips/<id>/itinerary);
 * the static demo build can't pre-render unknown ids, so it uses a query string (/trip/itinerary/?id=<id>).
 */
export const TRIP_TABS = ["itinerary", "map", "budget", "checklist", "settings"] as const;
export type TripTab = (typeof TRIP_TABS)[number] | "";

export function tripHref(id: string, tab: TripTab = ""): string {
  if (IS_DEMO) return `/trip/${tab ? `${tab}/` : ""}?id=${encodeURIComponent(id)}`;
  return `/trips/${id}${tab ? `/${tab}` : ""}`;
}

export function adminDestinationHref(id: string | "new"): string {
  return IS_DEMO ? `/admin/destination/?id=${encodeURIComponent(id)}` : `/admin/destinations/${id}`;
}

/** Current trip/destination id from the path segment or, in the demo build, the ?id= query. */
export function useRouteId(): string {
  const params = useParams<{ id?: string }>();
  // IS_DEMO is a build-time constant, so the hook order is stable within a build.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fromQuery = IS_DEMO ? useSearchParams().get("id") : null;
  return (params?.id as string | undefined) ?? fromQuery ?? "";
}

/** Which trip tab a pathname shows ("" = overview). */
export function tripTabOf(pathname: string): TripTab {
  const last = pathname.replace(/\/$/, "").split("/").pop() ?? "";
  return (TRIP_TABS as readonly string[]).includes(last) ? (last as TripTab) : "";
}
