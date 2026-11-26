"use client";

import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapMarker, TravelMapProps } from "./types";

// Tile provider is configurable; defaults to CARTO Voyager on OpenStreetMap data.
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const iconCache = new Map<string, L.DivIcon>();
function markerIcon(m: MapMarker): L.DivIcon {
  const key = `${m.color}|${m.badge ?? ""}|${m.highlighted ? 1 : 0}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = m.highlighted ? 34 : 28;
    icon = L.divIcon({
      className: "",
      html: `<div class="tm-marker" style="background:${m.color};width:${size}px;height:${size}px">${m.badge ?? ""}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function FitBounds({ markers, route, fitKey }: { markers: MapMarker[]; route?: [number, number][]; fitKey?: string }) {
  const map = useMap();
  React.useEffect(() => {
    const pts: [number, number][] = [...markers.map((m) => [m.lat, m.lng] as [number, number]), ...(route ?? [])];
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0], 13);
    else map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 14 });
    // Only refit when the set of things on the map changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return null;
}

function FocusOn({ focus }: { focus?: { lat: number; lng: number } | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [map, focus]);
  return null;
}

export default function LeafletMap({ markers, route, center, zoom = 11, fitKey, focus, onMarkerClick, className }: TravelMapProps) {
  const initialCenter: [number, number] = center ? [center.lat, center.lng] : markers[0] ? [markers[0].lat, markers[0].lng] : [14.5, 75.5];
  return (
    <MapContainer center={initialCenter} zoom={zoom} scrollWheelZoom className={className} style={{ height: "100%", width: "100%" }}>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <FitBounds markers={markers} route={route} fitKey={fitKey ?? markers.map((m) => m.id).join(",")} />
      <FocusOn focus={focus} />
      {route && route.length > 1 && (
        <Polyline positions={route} pathOptions={{ color: "#283C32", weight: 4, opacity: 0.75 }} />
      )}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={markerIcon(m)}
          title={m.title}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
        >
          {m.popup && <Popup>{m.popup}</Popup>}
        </Marker>
      ))}
    </MapContainer>
  );
}
