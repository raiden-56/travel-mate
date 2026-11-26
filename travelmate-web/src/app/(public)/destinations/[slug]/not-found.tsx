import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DestinationNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">We don&apos;t have that destination yet</h1>
      <p className="mt-2 text-sm text-ink-muted">It may have been unpublished, or the link is mistyped.</p>
      <Button className="mt-6" asChild>
        <Link href="/explore">Explore destinations</Link>
      </Button>
    </div>
  );
}
