import Link from "next/link";
import { Logo } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div>
        <h1 className="font-display text-4xl font-semibold">Off the map</h1>
        <p className="mt-2 text-sm text-ink-muted">We couldn&apos;t find that page.</p>
      </div>
      <div className="flex gap-2">
        <Button asChild><Link href="/explore">Explore destinations</Link></Button>
        <Button variant="secondary" asChild><Link href="/">Home</Link></Button>
      </div>
    </div>
  );
}
