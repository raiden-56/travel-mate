import type { LatLng, OptimizeResult, RouteResult, WeatherDto } from "@/types/api";
import { ApiError } from "@/lib/api-error";

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathKm(points: LatLng[], order: number[]): number {
  let km = 0;
  for (let i = 1; i < order.length; i++) km += haversineKm(points[order[i - 1]], points[order[i]]);
  return km;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nearest-neighbour + 2-opt over straight-line distances. */
export function optimizeOrder(points: LatLng[], keepFirst: boolean, keepLast: boolean): OptimizeResult {
  const n = points.length;
  const identity = points.map((_, i) => i);
  const start = 0;
  const remaining = new Set(identity.filter((i) => i !== start && !(keepLast && i === n - 1)));
  const order = [start];
  while (remaining.size) {
    const last = points[order[order.length - 1]];
    let best = -1;
    let bestKm = Infinity;
    for (const i of remaining) {
      const km = haversineKm(last, points[i]);
      if (km < bestKm) {
        bestKm = km;
        best = i;
      }
    }
    order.push(best);
    remaining.delete(best);
  }
  if (keepLast && n > 1) order.push(n - 1);
  // 2-opt, keeping the fixed ends in place.
  const lo = keepFirst ? 1 : 0;
  const hi = keepLast ? n - 2 : n - 1;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = lo; i < hi; i++) {
      for (let j = i + 1; j <= hi; j++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (pathKm(points, candidate) + 1e-9 < pathKm(points, order)) {
          order.splice(0, order.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return {
    provenance: { source: "straight-line", approximate: true, simulated: false, note: "Ordered by straight-line distance between stops." },
    order,
    distanceKmBefore: round1(pathKm(points, identity)),
    distanceKmAfter: round1(pathKm(points, order)),
  };
}

function straightLine(points: LatLng[]): RouteResult {
  const legs = points.slice(1).map((p, i) => ({ distanceKm: round1(haversineKm(points[i], p)), durationMinutes: null }));
  return {
    provenance: { source: "straight-line", approximate: true, simulated: false, note: "Road routing unavailable; showing straight-line distance only." },
    distanceKm: round1(legs.reduce((a, l) => a + l.distanceKm, 0)),
    durationMinutes: null,
    geometry: points.map((p) => [p.lat, p.lng]),
    legs,
  };
}

/** Driving route from the public OSRM demo server, falling back to straight-line distance. */
export async function route(points: LatLng[]): Promise<RouteResult> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return straightLine(points);
    const body = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { distance: number; duration: number }[] }[];
    };
    const r = body.routes?.[0];
    if (body.code !== "Ok" || !r) return straightLine(points);
    return {
      provenance: { source: "osrm", approximate: false, simulated: false, note: "OSRM public demo server (OpenStreetMap data)." },
      distanceKm: round1(r.distance / 1000),
      durationMinutes: round1(r.duration / 60),
      geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: r.legs.map((l) => ({ distanceKm: round1(l.distance / 1000), durationMinutes: round1(l.duration / 60) })),
    };
  } catch {
    return straightLine(points);
  }
}

const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain showers", 81: "Rain showers",
  82: "Violent rain showers", 85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};
const describe = (code: number) => WMO[code] ?? "Unknown";

const weatherCache = new Map<string, { at: number; data: WeatherDto }>();

/** Real forecast from Open-Meteo (keyless, CORS-enabled). Never invents weather: failures surface as 503. */
export async function weather(lat: number, lng: number): Promise<WeatherDto> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = weatherCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.data;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    "&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum" +
    "&timezone=auto&forecast_days=7";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const b = await res.json();
    const data: WeatherDto = {
      provenance: { source: "open-meteo", approximate: false, simulated: false },
      timezone: b.timezone,
      current: b.current
        ? {
            time: b.current.time,
            temperatureC: b.current.temperature_2m,
            apparentC: b.current.apparent_temperature,
            precipitationMm: b.current.precipitation,
            windKph: b.current.wind_speed_10m,
            weatherCode: b.current.weather_code,
            description: describe(b.current.weather_code),
          }
        : null,
      daily: (b.daily?.time ?? []).map((date: string, i: number) => ({
        date,
        minC: b.daily.temperature_2m_min[i],
        maxC: b.daily.temperature_2m_max[i],
        precipitationProbability: b.daily.precipitation_probability_max?.[i] ?? null,
        precipitationMm: b.daily.precipitation_sum[i],
        weatherCode: b.daily.weather_code[i],
        description: describe(b.daily.weather_code[i]),
      })),
    };
    weatherCache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    throw new ApiError({ status: 503, code: "PROVIDER_UNAVAILABLE", detail: "Weather is unavailable right now." });
  }
}
