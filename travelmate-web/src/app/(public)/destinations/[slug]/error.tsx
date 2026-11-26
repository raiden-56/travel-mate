"use client";

import { Button } from "@/components/ui/button";

export default function DestinationError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold">This destination couldn&apos;t be loaded</h1>
      <p className="mt-2 text-sm text-ink-muted">The service may be temporarily unavailable.</p>
      <Button className="mt-6" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
