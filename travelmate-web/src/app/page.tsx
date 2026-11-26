import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarRange, Compass, Map, Wallet } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import type { CategoryDto, DestinationSummary, PageResponse } from "@/types/api";
import { Hero, Reveal } from "@/components/landing/hero";
import { MobileTabBar, SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { formatMoneyRange } from "@/lib/money";

const steps = [
  { icon: Compass, title: "Discover", body: "Browse curated destinations by mood, season and budget. Save what catches your eye." },
  { icon: CalendarRange, title: "Plan", body: "Tell the planner your dates, pace and interests. Get a day-by-day draft you can edit freely." },
  { icon: Map, title: "Map it", body: "See every stop on a map, the route between them and how far each day really is." },
  { icon: Wallet, title: "Budget & pack", body: "Track spending against your budget and work through a packing list made for the trip." },
];

export default async function LandingPage() {
  const [featured, categories] = await Promise.all([
    serverGet<PageResponse<DestinationSummary>>("/destinations?featured=true&size=7&sort=featured"),
    serverGet<CategoryDto[]>("/destinations/categories"),
  ]);
  const destinations = featured.ok ? featured.data.items : [];
  const heroDest = destinations.find((d) => d.heroImageUrl) ?? null;

  return (
    <>
      {/* Positioning context so the transparent header sits on the hero, below any page banner. */}
      <div className="relative">
      <SiteHeader variant="overlay" />
      <main id="main" className="pb-16 lg:pb-0">
        <Hero
          image={heroDest?.heroImageUrl ?? null}
          imageAlt={heroDest ? `${heroDest.name}, ${heroDest.state}` : "TravelMate"}
          credit={heroDest?.heroImageCredit ?? null}
        />

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-terracotta">Where people are going</p>
              <h2 className="mt-1 font-display text-3xl font-semibold">Featured destinations</h2>
            </div>
            <Link href="/explore" className="hidden items-center gap-1 text-sm font-medium text-sage hover:underline sm:flex">
              Explore all <ArrowRight className="size-4" />
            </Link>
          </div>

          {destinations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-muted">
              Destinations are unavailable right now. <Link href="/explore" className="text-sage underline">Try Explore</Link>.
            </p>
          ) : (
            <Reveal className="grid auto-rows-[220px] gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[260px]">
              {destinations.slice(0, 7).map((d, i) => (
                <Link
                  key={d.id}
                  href={`/destinations/${d.slug}`}
                  data-reveal
                  className={`group relative overflow-hidden rounded-lg bg-surface-muted ${i === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`}
                >
                  {d.heroImageUrl && (
                    <Image
                      src={d.heroImageUrl}
                      alt={`${d.name}, ${d.state}`}
                      fill
                      sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className={`font-display font-semibold ${i === 0 ? "text-3xl" : "text-xl"}`}>{d.name}</p>
                    <p className="mt-0.5 text-sm text-white/80">
                      {d.categories.slice(0, 2).map((c) => c.name).join(" · ")}
                      {i === 0 && <> · from {formatMoneyRange(d.budgetPerDayMin, d.budgetPerDayMin, d.currency)}/day (est.)</>}
                    </p>
                  </div>
                </Link>
              ))}
            </Reveal>
          )}
        </section>

        <section className="bg-forest py-20 text-on-forest">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="max-w-xl font-display text-3xl font-semibold text-white">
              From “we should go somewhere” to the drive home.
            </h2>
            <Reveal className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <div key={s.title} data-reveal>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-sm text-amber">0{i + 1}</span>
                    <span className="h-px flex-1 bg-white/15" />
                  </div>
                  <s.icon className="mt-5 size-6 text-amber" aria-hidden />
                  <h3 className="mt-3 font-display text-lg font-semibold text-white">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/70">{s.body}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {categories.ok && categories.data.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-2xl font-semibold">Travel by mood</h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {categories.data.map((c) => (
                <Link
                  key={c.slug}
                  href={`/explore?category=${c.slug}`}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:border-sage hover:text-sage"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start gap-6 rounded-xl bg-amber-soft px-8 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold">Have three days and a vague idea?</h2>
              <p className="mt-1 text-sm text-ink-muted">That&apos;s enough to get a plan you can actually follow.</p>
            </div>
            <Button size="lg" asChild>
              <Link href="/planner">
                Start planning <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      </div>
      <SiteFooter />
      <MobileTabBar />
    </>
  );
}
