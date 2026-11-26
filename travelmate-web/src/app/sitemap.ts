import type { MetadataRoute } from "next";
import { serverGet } from "@/lib/server-api";
import type { DestinationSummary, PageResponse } from "@/types/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const res = await serverGet<PageResponse<DestinationSummary>>("/destinations?size=100&sort=name", 3600);
  const destinations = res.ok ? res.data.items : [];
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/explore`, changeFrequency: "daily", priority: 0.9 },
    ...destinations.map((d) => ({
      url: `${SITE_URL}/destinations/${d.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
