"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-ink-muted">The page hit an unexpected problem. Your saved data is safe.</p>
      <Button variant="secondary" onClick={reset}>Try again</Button>
    </div>
  );
}
