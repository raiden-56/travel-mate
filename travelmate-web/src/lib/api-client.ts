import type { ApiProblem, AuthResponse } from "@/types/api";
import { IS_DEMO } from "@/demo/config";
import { ApiError } from "./api-error";
import { useAuthStore } from "./auth-store";

export { ApiError };

/** Human-readable message for any thrown value; never leaks technical detail. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return "We couldn't reach TravelMate. Check your connection and try again.";
    if (error.status >= 500 && error.code !== "PROVIDER_UNAVAILABLE")
      return "Something went wrong on our side. Please try again.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

const BASE = "/api/v1";
const CSRF_HEADER = { "X-Requested-With": "travelmate" };

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined | string[]>;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry on 401 (used by auth endpoints themselves). */
  noRetry?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === "") continue;
      if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
      else params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ""}`;
}

async function parseProblem(res: Response): Promise<ApiProblem> {
  try {
    const body = (await res.json()) as Partial<ApiProblem>;
    return { ...body, status: res.status };
  } catch {
    return { status: res.status, title: res.statusText };
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the refresh cookie for a new access token. Single-flight across concurrent callers. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        if (IS_DEMO) {
          const { demoRequest } = await import("@/demo/router");
          const data = await demoRequest<AuthResponse>("POST", "/auth/refresh");
          useAuthStore.getState().setSession(data.accessToken, data.user);
          return true;
        }
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          credentials: "same-origin",
          headers: CSRF_HEADER,
        });
        if (!res.ok) {
          useAuthStore.getState().clear();
          return false;
        }
        const data = (await res.json()) as AuthResponse;
        useAuthStore.getState().setSession(data.accessToken, data.user);
        return true;
      } catch {
        useAuthStore.getState().clear();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (IS_DEMO) {
    // Static demo build: answered by the in-browser implementation of the API (src/demo).
    const { demoRequest } = await import("@/demo/router");
    return demoRequest<T>(opts.method ?? "GET", path, opts.query ?? {}, opts.body);
  }
  const doFetch = async () => {
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = { Accept: "application/json", ...CSRF_HEADER };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
    });
  };

  let res: Response;
  try {
    res = await doFetch();
    if (res.status === 401 && !opts.noRetry && useAuthStore.getState().accessToken) {
      const ok = await refreshSession();
      if (ok) res = await doFetch();
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError({ status: 0, title: "Network error" });
  }

  if (!res.ok) throw new ApiError(await parseProblem(res));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
