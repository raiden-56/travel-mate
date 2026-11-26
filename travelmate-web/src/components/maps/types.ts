import type * as React from "react";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  color: string;
  badge?: string;
  highlighted?: boolean;
  popup?: React.ReactNode;
};

export type TravelMapProps = {
  markers: MapMarker[];
  route?: [number, number][];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Change this to refit bounds; defaults to the marker id list. */
  fitKey?: string;
  focus?: { lat: number; lng: number } | null;
  onMarkerClick?: (id: string) => void;
  className?: string;
};

/** Marker colors by category, from the design tokens. */
export const CATEGORY_COLORS: Record<string, string> = {
  ATTRACTION: "#58745B",
  ACTIVITY: "#D5A06A",
  RESTAURANT: "#C78165",
  HOTEL: "#283C32",
  TRANSPORTATION: "#787B73",
  SHOPPING: "#B07B4F",
  REST: "#8FAE90",
  EVENT: "#A86A55",
  CUSTOM: "#5B6E7A",
  BEACH: "#4E8A9A",
  WATERFALL: "#3F7E8C",
  TEMPLE: "#C78165",
  FORT: "#8A6A4A",
  VIEWPOINT: "#58745B",
  NATURE: "#58745B",
  WILDLIFE: "#6B7F3A",
  ADVENTURE: "#D5A06A",
};
