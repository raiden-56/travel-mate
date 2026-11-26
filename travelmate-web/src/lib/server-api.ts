import "server-only";
import { IS_DEMO } from "@/demo/config";
import { ApiError } from "./api-error";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export type ServerResult<T> = { ok: true; data: T } | { ok: false; status: number };

/**
 * Server-side fetch for public, cacheable pages (SEO routes). Anonymous only — never forwards
 * user credentials. Revalidates every 5 minutes so admin edits show up without a redeploy.
 * In the static demo build it reads the bundled seed data instead of calling the API.
 */
export async function serverGet<T>(path: string, revalidate = 300): Promise<ServerResult<T>> {
  if (IS_DEMO) {
    try {
      const { demoServerGet } = await import("@/demo/router");
      return { ok: true, data: await demoServerGet<T>(path) };
    } catch (e) {
      return { ok: false, status: e instanceof ApiError ? e.status : 500 };
    }
  }
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}
