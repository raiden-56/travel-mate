import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Bus,
  CalendarDays,
  Clock,
  Lightbulb,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  Sun,
  Wallet,
} from "lucide-react";
import { serverGet } from "@/lib/server-api";
import type { DestinationDetail } from "@/types/api";
import { formatDuration } from "@/lib/dates";
import { formatMoneyRange } from "@/lib/money";
import { titleCase } from "@/lib/utils";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { EstimateBadge, SeedBadge } from "@/components/common/labels";
import { LiveSaveButton } from "@/components/common/live-save-button";
import { DestinationCard } from "@/components/destinations/destination-card";
import { WeatherPanel } from "@/components/destinations/weather-panel";
import { AttractionMap } from "@/components/destinations/attraction-map";

type Props = { params: Promise<{ slug: string }> };

/** JSON for inline <script> tags; escapes `<` so admin-entered text can't close the tag. */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

async function load(slug: string) {
  const res = await serverGet<DestinationDetail>(`/destinations/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    if (res.status === 404) notFound();
    throw new Error("Destination unavailable");
  }
  return res.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const res = await serverGet<DestinationDetail>(`/destinations/${encodeURIComponent(slug)}`);
  if (!res.ok) return { title: "Destination" };
  const d = res.data;
  const title = d.seoTitle ?? `${d.name} travel guide — things to do, best time & budget`;
  const description = d.seoDescription ?? d.summary;
  return {
    title,
    description,
    alternates: { canonical: `/destinations/${d.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/destinations/${d.slug}`,
      images: d.heroImageUrl ? [{ url: d.heroImageUrl, alt: d.name }] : undefined,
    },
  };
}

function Fact({ icon: Icon, label, children }: { icon: typeof Sun; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
      <div>
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className="text-sm font-medium">{children}</dd>
      </div>
    </div>
  );
}

const sections = [
  { id: "overview", label: "Overview" },
  { id: "things-to-do", label: "Things to do" },
  { id: "map", label: "Map" },
  { id: "getting-there", label: "Getting there" },
  { id: "tips", label: "Tips & safety" },
  { id: "faqs", label: "FAQs" },
];

export default async function DestinationPage({ params }: Props) {
  const { slug } = await params;
  const d = await load(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: d.name,
    description: d.summary,
    image: d.heroImageUrl ?? undefined,
    geo: { "@type": "GeoCoordinates", latitude: d.latitude, longitude: d.longitude },
    address: { "@type": "PostalAddress", addressRegion: d.state, addressCountry: d.country },
    includesAttraction: d.attractions.map((a) => ({
      "@type": "TouristAttraction",
      name: a.name,
      geo: { "@type": "GeoCoordinates", latitude: a.latitude, longitude: a.longitude },
    })),
  };
  const faqLd =
    d.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: d.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
        }
      : null;

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(faqLd) }} />}

      {/* Hero */}
      <header className="relative isolate overflow-hidden bg-forest">
        <div className="absolute inset-0 -z-10">
          {d.heroImageUrl && (
            <Image src={d.heroImageUrl} alt={`${d.name}, ${d.state}`} fill priority sizes="100vw" className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        </div>
        <div className="mx-auto flex min-h-[58svh] max-w-7xl flex-col justify-end px-4 pb-10 pt-24 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-white/70">
            <Link href="/explore" className="hover:text-white">Explore</Link> <span aria-hidden>/</span>{" "}
            <span className="text-white">{d.name}</span>
          </nav>
          <div className="flex flex-wrap gap-1.5">
            {d.categories.map((c) => (
              <Link key={c.slug} href={`/explore?category=${c.slug}`} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur hover:bg-white/25">
                {c.name}
              </Link>
            ))}
          </div>
          <h1 className="mt-3 font-display text-5xl font-bold text-white sm:text-7xl">{d.name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-white/85">
            <MapPin className="size-4" aria-hidden /> {d.region}, {d.state}, {d.country}
          </p>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/85">{d.summary}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="accent" asChild>
              <Link href={`/planner?destination=${d.slug}`}>
                <Sparkles /> Plan a trip here
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/trips/new?destination=${d.slug}`}>Add to a new trip</Link>
            </Button>
            <LiveSaveButton targetType="DESTINATION" targetId={d.id} name={d.name} />
          </div>
          {d.heroImageCredit && <p className="mt-6 text-[10.5px] text-white/50">Photo: {d.heroImageCredit}</p>}
        </div>
      </header>

      {/* In-page nav */}
      <nav aria-label="On this page" className="sticky top-16 z-30 border-b border-line bg-canvas/95 backdrop-blur">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block whitespace-nowrap px-3 py-3 text-sm text-ink-muted hover:text-ink">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-16">
          <section id="overview" className="scroll-mt-32">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-display text-2xl font-semibold">Overview</h2>
              {d.seedData && <SeedBadge />}
            </div>
            <div className="max-w-none space-y-4 text-[15px] leading-relaxed text-ink/90">
              {d.description.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {d.gallery.length > 0 && (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {d.gallery.slice(0, 6).map((g, i) => (
                  <figure key={g.url} className={`relative overflow-hidden rounded-lg bg-surface-muted ${i === 0 ? "col-span-2 row-span-2 aspect-square sm:aspect-auto" : "aspect-[4/3]"}`}>
                    <Image src={g.url} alt={g.alt} fill sizes="(min-width: 1024px) 30vw, 50vw" className="object-cover" />
                    {g.credit && <figcaption className="absolute bottom-1 right-2 text-[10px] text-white/70">{g.credit}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
          </section>

          <section id="things-to-do" className="scroll-mt-32">
            <h2 className="font-display text-2xl font-semibold">Things to do in {d.name}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Costs are typical per-person estimates, not quotes. Opening hours are not verified — check locally.
            </p>
            {d.attractions.length === 0 ? (
              <p className="mt-6 text-sm text-ink-muted">No places have been added for this destination yet.</p>
            ) : (
              <ul className="mt-6 divide-y divide-line rounded-lg bg-surface shadow-[var(--shadow-soft)]">
                {d.attractions.map((a) => (
                  <li key={a.id} id={`attraction-${a.slug}`} className="scroll-mt-32 p-5">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-[16px] font-semibold">{a.name}</h3>
                          <Badge tone="sage">{titleCase(a.category)}</Badge>
                          {a.familyFriendly && <Badge>Family-friendly</Badge>}
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink/85">{a.description}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
                          <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {formatDuration(a.typicalDurationMinutes)}</span>
                          <span className="flex items-center gap-1">
                            <Wallet className="size-3.5" aria-hidden />
                            {a.costMax === "0.00" ? "Free" : formatMoneyRange(a.costMin, a.costMax, a.currency)}
                            {a.costMax !== "0.00" && <EstimateBadge />}
                          </span>
                          {a.bestTimeOfDay !== "ANY" && <span>Best in the {a.bestTimeOfDay.toLowerCase()}</span>}
                        </p>
                        {a.costNote && <p className="mt-1 text-xs text-ink-muted">{a.costNote}</p>}
                        {a.accessibilityNote && <p className="mt-1 text-xs text-ink-muted">Accessibility: {a.accessibilityNote}</p>}
                      </div>
                      <LiveSaveButton targetType="ATTRACTION" targetId={a.id} name={a.name} variant="overlay" className="border border-line" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="map" className="scroll-mt-32">
            <h2 className="mb-4 font-display text-2xl font-semibold">Map</h2>
            <AttractionMap attractions={d.attractions} center={{ lat: d.latitude, lng: d.longitude }} />
          </section>

          <section id="getting-there" className="scroll-mt-32 grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Navigation className="size-5 text-sage" aria-hidden /> How to reach</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/85">{d.howToReach}</p>
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Bus className="size-5 text-sage" aria-hidden /> Getting around</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/85">{d.localTransport}</p>
            </div>
          </section>

          <section id="tips" className="scroll-mt-32 grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Lightbulb className="size-5 text-amber" aria-hidden /> Travel tips</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink/85">
                {d.travelTips.map((t, i) => (
                  <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber" aria-hidden />{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><ShieldCheck className="size-5 text-sage" aria-hidden /> Safety</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/85">{d.safetyInfo}</p>
            </div>
          </section>

          {d.faqs.length > 0 && (
            <section id="faqs" className="scroll-mt-32">
              <h2 className="font-display text-2xl font-semibold">Frequently asked</h2>
              <div className="mt-4 divide-y divide-line rounded-lg bg-surface shadow-[var(--shadow-soft)]">
                {d.faqs.map((f) => (
                  <details key={f.question} className="group p-5">
                    <summary className="cursor-pointer list-none font-medium marker:hidden">
                      <span className="flex items-center justify-between gap-4">
                        {f.question}
                        <span className="text-ink-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-ink/85">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-lg bg-surface p-5 shadow-[var(--shadow-soft)]">
            <h2 className="font-display text-base font-semibold">At a glance</h2>
            <dl className="mt-4 space-y-4">
              <Fact icon={Sun} label="Best time to visit">{d.bestTimeToVisit}</Fact>
              <Fact icon={CalendarDays} label="Recommended stay">{d.recommendedDaysMin}–{d.recommendedDaysMax} days</Fact>
              <Fact icon={Wallet} label="Typical spend per person per day">
                <span className="flex items-center gap-2">
                  {formatMoneyRange(d.budgetPerDayMin, d.budgetPerDayMax, d.currency)} <EstimateBadge />
                </span>
              </Fact>
            </dl>
          </div>
          <div className="rounded-lg bg-surface p-5 shadow-[var(--shadow-soft)]">
            <h2 className="mb-4 font-display text-base font-semibold">Weather now</h2>
            <WeatherPanel slug={d.slug} compact />
          </div>
        </aside>
      </div>

      {d.similar.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold">You might also like</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {d.similar.slice(0, 4).map((s) => (
              <DestinationCard key={s.id} destination={s} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
