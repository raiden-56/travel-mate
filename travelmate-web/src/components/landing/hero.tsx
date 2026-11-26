"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchDialog } from "@/components/layout/search-dialog";

gsap.registerPlugin(ScrollTrigger);

export function Hero({ image, imageAlt, credit }: { image: string | null; imageAlt: string; credit: string | null }) {
  const root = React.useRef<HTMLElement>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-hero-line]", { y: 28, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 });
      gsap.to("[data-hero-image]", {
        yPercent: 12,
        scale: 1.06,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative isolate flex min-h-[88svh] items-end overflow-hidden bg-forest">
      <div data-hero-image className="absolute inset-0 -z-10">
        {image ? (
          <Image src={image} alt={imageAlt} fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-sage to-forest" />
        )}
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />

      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-32 sm:px-6 sm:pb-24">
        <p data-hero-line className="mb-4 text-sm font-medium tracking-wide text-amber">
          Discover · Plan · Travel · Remember
        </p>
        <h1 data-hero-line className="max-w-3xl font-display text-[40px] font-bold leading-[1.05] text-white sm:text-6xl">
          Your entire journey.
          <br />
          One place.
        </h1>
        <p data-hero-line className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-base">
          Find places worth the drive, turn them into a realistic day-by-day plan, see it on a map, and keep the budget
          and packing list beside it.
        </p>
        <div data-hero-line className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-12 w-full items-center gap-3 rounded-md bg-white px-4 text-left text-[15px] text-ink-muted shadow-lg sm:w-96"
          >
            <Search className="size-4 text-sage" aria-hidden /> Where to next?
          </button>
          <Button size="lg" variant="accent" asChild>
            <Link href="/planner">
              <Sparkles /> Plan a trip <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
      {credit && (
        <p className="absolute bottom-2 right-3 text-[10.5px] text-white/50">
          {imageAlt} · {credit}
        </p>
      )}
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </section>
  );
}

/** Fades sections up as they enter the viewport. Respects reduced motion. */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-reveal]", {
        y: 32,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ref.current, start: "top 80%" },
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
