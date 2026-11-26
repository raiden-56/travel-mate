import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:8080";
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const remotePatterns = [
  { protocol: "https" as const, hostname: "upload.wikimedia.org" },
  { protocol: "https" as const, hostname: "thumb.wikimedia.org" },
  { protocol: "https" as const, hostname: "images.unsplash.com" },
];

/**
 * Two builds from one codebase:
 * - default: server build that talks to travelmate-api (path-segment routes in *.dyn.tsx).
 * - NEXT_PUBLIC_DEMO_MODE=1: fully static export for GitHub Pages with the in-browser demo
 *   backend (query-string routes in *.demo.tsx, since unknown ids can't be pre-rendered).
 */
const nextConfig: NextConfig = DEMO
  ? {
      output: "export",
      basePath: BASE_PATH,
      trailingSlash: true,
      pageExtensions: ["demo.tsx", "tsx", "ts"],
      images: { unoptimized: true, remotePatterns },
      poweredByHeader: false,
    }
  : {
      pageExtensions: ["dyn.tsx", "tsx", "ts"],
      // Browser calls stay same-origin (/api/v1/*) so the refresh cookie is first-party.
      async rewrites() {
        return [{ source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` }];
      },
      images: { remotePatterns },
      poweredByHeader: false,
    };

export default nextConfig;
