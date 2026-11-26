const DAY_MS = 86_400_000;

/** Parse a YYYY-MM-DD string as a local calendar date (no timezone shift). */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetweenInclusive(start: string, end: string): number {
  return Math.round((parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / DAY_MS) + 1;
}

export function addDays(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Whole days from today (local) until the given date; negative if past. */
export function daysUntil(date: string, today: Date = new Date()): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((parseLocalDate(date).getTime() - t.getTime()) / DAY_MS);
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "—";
  const date = value.length === 10 ? parseLocalDate(value) : new Date(value);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", ...opts }).format(date);
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Dates not set";
  if (!end || end === start) return formatDate(start);
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", o).format(d);
  if (sameMonth) return `${s.getDate()}–${fmt(e, { day: "numeric", month: "short", year: "numeric" })}`;
  if (sameYear) return `${fmt(s, { day: "numeric", month: "short" })} – ${fmt(e, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
