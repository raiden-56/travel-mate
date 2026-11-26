"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";
import type { TravelMapProps } from "./types";

// Leaflet touches `window` at import time, so the map only renders on the client.
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

export function TravelMap(props: TravelMapProps) {
  return <LeafletMap {...props} />;
}

export type { MapMarker } from "./types";
export { CATEGORY_COLORS } from "./types";
