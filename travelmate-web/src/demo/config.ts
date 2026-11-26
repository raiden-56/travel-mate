/**
 * Demo mode: the static GitHub Pages build has no server, so API calls are answered by an
 * in-browser implementation of docs/API.md (src/demo/router.ts) that stores data in this
 * browser only. The normal build talks to travelmate-api and never loads the demo code.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/** Path prefix the site is served under (e.g. "/travel-mate" on GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Demo-only administrator, created in each visitor's own browser storage. */
export const DEMO_ADMIN = { email: "admin@demo.travelmate", password: "demo-admin-2026", name: "Demo Admin" };
