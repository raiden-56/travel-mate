import { Suspense } from "react";
import WorkspaceLayout from "@/components/trip-workspace/workspace-layout";

// Demo build: trip id comes from ?id=, which needs a Suspense boundary in a static export.
export default function DemoTripLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <WorkspaceLayout>{children}</WorkspaceLayout>
    </Suspense>
  );
}
