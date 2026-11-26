// Per-device conveniences only (recent searches, theme). Every access is guarded: storage may be
// unavailable (private mode, blocked site data) and the app must work without it.

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const RECENT_KEY = "tm-recent-searches";

export function getRecentSearches(): string[] {
  return readLocal<string[]>(RECENT_KEY, []);
}

export function pushRecentSearch(q: string): void {
  const v = q.trim();
  if (v.length < 2) return;
  const next = [v, ...getRecentSearches().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6);
  writeLocal(RECENT_KEY, next);
}

export function clearRecentSearches(): void {
  writeLocal(RECENT_KEY, []);
}

export function setTheme(theme: "light" | "dark"): void {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  try {
    window.localStorage.setItem("tm-theme", theme);
  } catch {
    /* ignore */
  }
}

export function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
