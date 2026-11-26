import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreView } from "./explore-view";

export const metadata: Metadata = {
  title: "Explore destinations",
  description: "Beaches, hill stations, waterfalls, heritage and weekend getaways — filter by budget, trip length and mood.",
  alternates: { canonical: "/explore" },
};

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreView />
    </Suspense>
  );
}
