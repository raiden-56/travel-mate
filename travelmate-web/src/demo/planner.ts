import type {
  Accommodation,
  AttractionDto,
  EngineInfo,
  ItineraryItemDto,
  PlanProposal,
  PlanRequest,
  ProposedItem,
} from "@/types/api";
import { fromMinor, toMinor } from "@/lib/money";
import { addDays } from "@/lib/dates";
import type { DemoDestination, DemoTrip } from "./db";
import { haversineKm } from "./geo";

export const DEMO_ENGINE: EngineInfo = {
  id: "deterministic",
  label: "Demo planner — runs in your browser",
  model: null,
  simulated: true,
};

const PER_DAY = { RELAXED: 2, BALANCED: 3, PACKED: 4 } as const;
const LUNCH_PP: Record<Accommodation, number> = { BUDGET: 250, HOSTEL: 200, CAMPING: 250, HOMESTAY: 300, MIDRANGE: 450, LUXURY: 1200 };
const STAY_PER_ROOM: Partial<Record<Accommodation, number>> = { BUDGET: 1500, HOMESTAY: 2200, MIDRANGE: 3500, LUXURY: 9000 };
const STAY_PER_PERSON: Partial<Record<Accommodation, number>> = { HOSTEL: 700, CAMPING: 1200 };

const INTEREST_CATEGORIES: Record<string, string[]> = {
  beaches: ["BEACH"], waterfalls: ["WATERFALL"], temples: ["TEMPLE"], heritage: ["HERITAGE", "FORT", "MUSEUM"],
  forts: ["FORT"], viewpoints: ["VIEWPOINT"], trekking: ["ADVENTURE", "NATURE"], wildlife: ["WILDLIFE"],
  "water sports": ["ADVENTURE"], islands: ["ISLAND"], food: ["RESTAURANT", "CAFE", "MARKET"], markets: ["MARKET"],
  photography: ["VIEWPOINT", "HERITAGE"], sunsets: ["BEACH", "VIEWPOINT"],
};
const STYLE_CATEGORIES: Record<string, string[]> = {
  ADVENTURE: ["ADVENTURE", "NATURE", "WATERFALL"], NATURE: ["NATURE", "WATERFALL", "WILDLIFE", "VIEWPOINT"],
  CULTURAL: ["TEMPLE", "HERITAGE", "MUSEUM", "FORT"], PHOTOGRAPHY: ["VIEWPOINT", "HERITAGE", "BEACH"],
  FOOD: ["RESTAURANT", "CAFE", "MARKET"], RELAXED: ["BEACH", "VIEWPOINT"], COUPLE: ["BEACH", "VIEWPOINT"],
};
const KEYWORD_CATEGORY: Record<string, string> = {
  waterfall: "WATERFALL", beach: "BEACH", temple: "TEMPLE", fort: "FORT", viewpoint: "VIEWPOINT",
  island: "ISLAND", museum: "MUSEUM", wildlife: "WILDLIFE", adventure: "ADVENTURE", trek: "ADVENTURE", market: "MARKET",
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const ceil15 = (m: number) => Math.ceil(m / 15) * 15;
const travelMinutes = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
  Math.max(15, ceil15((haversineKm({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude }) / 30) * 60));
const timeRank = { MORNING: 0, ANY: 1, AFTERNOON: 2, EVENING: 3 } as const;
const money = (minor: bigint) => fromMinor(minor);

function attractionCost(a: AttractionDto, travelers: number): bigint {
  const mid = (toMinor(a.costMin) + toMinor(a.costMax)) / 2n;
  return mid * BigInt(travelers);
}

function itemCategory(a: AttractionDto): ProposedItem["category"] {
  if (a.category === "RESTAURANT" || a.category === "CAFE") return "RESTAURANT";
  if (a.category === "ADVENTURE") return "ACTIVITY";
  if (a.category === "MARKET") return "SHOPPING";
  return "ATTRACTION";
}

type Ctx = { req: PlanRequest; dest: DemoDestination; accommodation: Accommodation; veg: boolean };

function score(a: AttractionDto, ctx: Ctx): { score: number; why: string[] } {
  let s = 1;
  const why: string[] = [];
  for (const interest of ctx.req.interests) {
    if (INTEREST_CATEGORIES[interest]?.includes(a.category) || a.tags.some((t) => t.toLowerCase().includes(interest.replace(/s$/, "")))) {
      s += 2;
      why.push(`matches your interest in ${interest}`);
    }
  }
  for (const style of ctx.req.styles) {
    if (STYLE_CATEGORIES[style]?.includes(a.category)) s += 1.5;
    if (style === "FAMILY") s += a.familyFriendly ? 1 : -1.5;
    if (style === "BUDGET" && a.costMax === "0.00") s += 1;
    if (style === "LUXURY" && toMinor(a.costMax) > 50000n) s += 0.5;
  }
  if (ctx.req.accessibility?.trim()) {
    if (a.category === "ADVENTURE") s -= 2;
    if (a.accessibilityNote) s += 0.5;
  }
  if (a.costMax === "0.00") why.push("free to visit");
  return { score: s, why };
}

function stayItem(day: number, ctx: Ctx): ProposedItem {
  const travelers = ctx.req.travelers;
  const perPerson = STAY_PER_PERSON[ctx.accommodation];
  const perRoom = STAY_PER_ROOM[ctx.accommodation] ?? 3500;
  const rooms = Math.ceil(travelers / 2);
  const cost = perPerson ? BigInt(perPerson * 100) * BigInt(travelers) : BigInt(perRoom * 100) * BigInt(rooms);
  const tier = ctx.accommodation.toLowerCase();
  return proposed(day, {
    title: `Overnight stay (${tier})`,
    description: perPerson ? `${travelers} bed(s), typical ${tier} rate` : `${rooms} room(s), typical ${tier} rate`,
    category: "HOTEL",
    estimatedCost: money(cost),
    reason: "Estimated nightly rate for your chosen stay type. Not a quote — book separately.",
  });
}

function mealItem(day: number, kind: "Lunch" | "Dinner", start: number, ctx: Ctx): ProposedItem {
  const pp = LUNCH_PP[ctx.accommodation] * (kind === "Dinner" ? 1.4 : 1);
  return proposed(day, {
    title: `${kind}${ctx.veg ? " — vegetarian-friendly place" : " — local restaurant"}`,
    description: ctx.veg ? "Look for udupi-style or pure-veg restaurants nearby." : "Pick somewhere close to the last stop.",
    category: "RESTAURANT",
    startTime: hhmm(start),
    endTime: hhmm(start + (kind === "Lunch" ? 60 : 75)),
    durationMinutes: kind === "Lunch" ? 60 : 75,
    estimatedCost: money(BigInt(Math.round(pp * 100)) * BigInt(ctx.req.travelers)),
    reason: "Meal break so the day stays realistic. Cost is a typical per-person estimate.",
  });
}

function proposed(day: number, p: Partial<ProposedItem> & Pick<ProposedItem, "title" | "category">): ProposedItem {
  return {
    dayNumber: day,
    position: 0,
    description: "",
    attractionId: null,
    locationName: null,
    latitude: null,
    longitude: null,
    startTime: null,
    endTime: null,
    durationMinutes: null,
    estimatedCost: null,
    currency: "INR",
    reason: "",
    alternatives: [],
    locked: false,
    sourceItemId: null,
    ...p,
  };
}

function fromAttraction(day: number, a: AttractionDto, start: number, ctx: Ctx, why: string[], alternatives: string[]): ProposedItem {
  const cost = attractionCost(a, ctx.req.travelers);
  return proposed(day, {
    title: a.name,
    description: a.description,
    category: itemCategory(a),
    attractionId: a.id,
    locationName: a.name,
    latitude: a.latitude,
    longitude: a.longitude,
    startTime: hhmm(start),
    endTime: hhmm(start + a.typicalDurationMinutes),
    durationMinutes: a.typicalDurationMinutes,
    estimatedCost: cost === 0n ? "0.00" : money(cost),
    reason: [
      why.length ? why.join(", ") : "one of the area's well-known stops",
      a.bestTimeOfDay !== "ANY" ? `best in the ${a.bestTimeOfDay.toLowerCase()}` : "",
    ]
      .filter(Boolean)
      .join("; ")
      .replace(/^./, (c) => c.toUpperCase()) + ".",
    alternatives,
  });
}

/** Schedules one day's attractions (already in visiting order) with travel buffers and meals. */
function scheduleDay(day: number, stops: AttractionDto[], ctx: Ctx, why: Map<string, string[]>, alts: Map<string, string[]>, isLastDay: boolean, totalDays: number): ProposedItem[] {
  const ordered = [...stops].sort((a, b) => timeRank[a.bestTimeOfDay] - timeRank[b.bestTimeOfDay]);
  const out: ProposedItem[] = [];
  let t = ctx.req.pace === "RELAXED" ? 570 : 510;
  if (day === 1 && ctx.req.startLocation) t = Math.max(t, 660);
  let lunch = false;
  let prev: AttractionDto | null = null;
  for (const a of ordered) {
    if (prev) t += travelMinutes(prev, a);
    if (!lunch && t >= 750) {
      out.push(mealItem(day, "Lunch", t, ctx));
      t += 75;
      lunch = true;
    }
    if (a.bestTimeOfDay === "EVENING" && t < 990) t = 990;
    out.push(fromAttraction(day, a, t, ctx, why.get(a.id) ?? [], alts.get(a.id) ?? []));
    t += a.typicalDurationMinutes;
    prev = a;
  }
  if (!lunch && ordered.length) out.push(mealItem(day, "Lunch", Math.max(780, Math.min(t, 840)), ctx));
  out.push(mealItem(day, "Dinner", Math.max(t + 30, 1170), ctx));
  if (!isLastDay && day < totalDays) out.push(stayItem(day, ctx));
  return out
    .sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"))
    .map((it, i) => ({ ...it, position: i }));
}

type Located = { latitude: number; longitude: number };

function nearestNeighbour<T extends Located>(points: T[], start: Located): T[] {
  const left = [...points];
  const out: T[] = [];
  let cur: Located = start;
  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((p, i) => {
      const d = haversineKm({ lat: cur.latitude, lng: cur.longitude }, { lat: p.latitude, lng: p.longitude });
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    cur = left[bi];
    out.push(left.splice(bi, 1)[0]);
  }
  return out;
}

function summarise(days: PlanProposal["days"], budget: string | undefined): Pick<PlanProposal, "estimatedTotal" | "budgetStatus"> {
  const total = days.flatMap((d) => d.items).reduce((acc, i) => acc + toMinor(i.estimatedCost), 0n);
  return {
    estimatedTotal: money(total),
    budgetStatus: !budget ? "UNKNOWN" : total > toMinor(budget) ? "OVER" : "WITHIN",
  };
}

export function generatePlan(req: PlanRequest, dest: DemoDestination): Omit<PlanProposal, "id" | "createdAt" | "tripId"> {
  const ctx: Ctx = { req, dest, accommodation: req.accommodation ?? "MIDRANGE", veg: /veg/i.test(req.dietary ?? "") };
  const perDay = PER_DAY[req.pace];
  const scored = dest.attractions.map((a) => ({ a, ...score(a, ctx) })).sort((x, y) => y.score - x.score);
  const want = req.days * perDay;
  const chosen = scored.slice(0, want);
  const why = new Map(chosen.map((c) => [c.a.id, c.why]));
  const unused = scored.slice(want).map((c) => c.a);
  const alts = new Map(chosen.map((c) => [c.a.id, unused.filter((u) => u.category === c.a.category).slice(0, 2).map((u) => u.name)]));
  const ordered = nearestNeighbour(chosen.map((c) => c.a), dest);

  const days: PlanProposal["days"] = [];
  const base = Math.floor(ordered.length / req.days);
  let extra = ordered.length % req.days;
  let cursor = 0;
  for (let d = 1; d <= req.days; d++) {
    const n = base + (extra-- > 0 ? 1 : 0);
    const stops = ordered.slice(cursor, cursor + n);
    cursor += n;
    days.push({
      dayNumber: d,
      date: req.startDate ? addDays(req.startDate, d - 1) : null,
      title: stops.length ? stops.slice(0, 2).map((s) => s.name).join(" & ") : "Free day",
      items: scheduleDay(d, stops, ctx, why, alts, d === req.days, req.days),
    });
  }
  if (req.startLocation && days[0]) {
    days[0].items.unshift(
      proposed(1, {
        title: `Travel from ${req.startLocation}`,
        description: "Arrive by late morning. The demo planner doesn't estimate inter-city travel time or fare.",
        category: "TRANSPORTATION",
        reason: "Getting there — plan this leg separately.",
      }),
    );
    days[0].items = days[0].items.map((it, i) => ({ ...it, position: i }));
  }

  const warnings: string[] = [];
  if (chosen.length < want) warnings.push(`Only ${chosen.length} curated places fit — some days are lighter than your chosen pace.`);
  const totals = summarise(days, req.budget);
  if (totals.budgetStatus === "OVER")
    warnings.push(`The estimate is above your ₹${Number(req.budget).toLocaleString("en-IN")} budget. Try “Make this trip cheaper” after saving.`);
  return {
    engine: DEMO_ENGINE,
    request: req,
    summary: `${req.days} day${req.days === 1 ? "" : "s"} in ${dest.name} for ${req.travelers} at a ${req.pace.toLowerCase()} pace: ${chosen.length} places ordered to keep driving short, with meal breaks${req.days > 1 ? " and overnight stays" : ""}.`,
    days,
    ...totals,
    currency: "INR",
    tips: dest.travelTips.slice(0, 3),
    assumptions: [
      "Costs are typical estimates, not quotes or live prices.",
      "Travel time between stops assumes about 30 km/h over straight-line distance.",
      "Opening hours are not verified — check locally.",
      ...(ctx.veg ? ["Meals assume vegetarian-friendly restaurants are available nearby."] : []),
    ],
    warnings,
  };
}

const PROTECTED = (i: ItineraryItemDto) => i.locked || i.status === "BOOKED" || i.status === "COMPLETED";

function carry(i: ItineraryItemDto): ProposedItem {
  return proposed(i.dayNumber, {
    position: i.position,
    title: i.title,
    description: i.description ?? "",
    category: i.category,
    attractionId: i.attractionId,
    locationName: i.locationName,
    latitude: i.latitude,
    longitude: i.longitude,
    startTime: i.startTime,
    endTime: i.endTime,
    durationMinutes: i.durationMinutes,
    estimatedCost: i.estimatedCost,
    currency: i.currency,
    reason: i.aiReason ?? "From your current plan.",
    locked: PROTECTED(i),
    sourceItemId: i.id,
  });
}

/**
 * Applies a natural-language change to an existing itinerary using keyword rules.
 * Kept (locked), booked and completed items are never removed or moved.
 */
export function modifyPlan(
  instruction: string,
  trip: DemoTrip,
  items: ItineraryItemDto[],
  dest: DemoDestination | null,
): Omit<PlanProposal, "id" | "createdAt" | "tripId"> {
  const text = instruction.toLowerCase();
  let dayCount = trip.dayCount;
  let list = items.filter((i) => i.status !== "CANCELLED").map(carry);
  const changes: string[] = [];
  const warnings: string[] = [];
  const req: PlanRequest = {
    destinationSlug: trip.destinationSlug ?? undefined,
    days: trip.dayCount,
    travelers: trip.travelers,
    budget: trip.budgetAmount ?? undefined,
    styles: trip.tripType ? [trip.tripType] : [],
    interests: [],
    pace: "BALANCED",
  };
  const ctx: Ctx = { req, dest: dest!, accommodation: "MIDRANGE", veg: /veg/.test(text) };
  const used = new Set(list.map((i) => i.attractionId).filter(Boolean));
  const unused = () => (dest?.attractions ?? []).filter((a) => !used.has(a.id));
  const cost = (i: ProposedItem) => toMinor(i.estimatedCost);
  const total = () => list.reduce((a, i) => a + cost(i), 0n);
  const isActivity = (i: ProposedItem) => ["ATTRACTION", "ACTIVITY", "SHOPPING", "EVENT"].includes(i.category);

  const addAttraction = (a: AttractionDto, day?: number) => {
    const target =
      day ??
      Array.from({ length: dayCount }, (_, k) => k + 1).sort(
        (x, y) => list.filter((i) => i.dayNumber === x && isActivity(i)).length - list.filter((i) => i.dayNumber === y && isActivity(i)).length,
      )[0];
    const dayItems = list.filter((i) => i.dayNumber === target && i.startTime);
    const lastEnd = dayItems.reduce((m, i) => Math.max(m, i.endTime ? toMin(i.endTime) : toMin(i.startTime!) + (i.durationMinutes ?? 60)), 540);
    const start = Math.min(ceil15(lastEnd + 30), 1260);
    list.push(fromAttraction(target, a, start, ctx, ["added at your request"], []));
    used.add(a.id);
    changes.push(`added ${a.name} to day ${target}`);
  };

  // Budget target: "under 15000" / "below ₹15,000"
  const budgetMatch = text.replace(/[,₹]/g, "").match(/(?:under|below|less than|within)\s+(\d{3,9})/);
  if (/cheaper|budget|save money/.test(text) || budgetMatch) {
    const target = budgetMatch ? BigInt(budgetMatch[1]) * 100n : (total() * 80n) / 100n;
    const removable = list.filter((i) => !i.locked && isActivity(i) && cost(i) > 0n).sort((a, b) => Number(cost(b) - cost(a)));
    for (const r of removable) {
      if (total() <= target) break;
      list = list.filter((i) => i !== r);
      changes.push(`dropped ${r.title}`);
    }
    if (total() > target) warnings.push("Couldn't get under the target without touching kept, booked or meal items.");
  }
  if (/less hectic|relax|slower|lighter|fewer/.test(text)) {
    for (let d = 1; d <= dayCount; d++) {
      const acts = list.filter((i) => i.dayNumber === d && isActivity(i));
      const removable = acts.filter((i) => !i.locked).reverse();
      while (acts.length > 2 && removable.length) {
        const r = removable.shift()!;
        acts.splice(acts.indexOf(r), 1);
        list = list.filter((i) => i !== r);
        changes.push(`dropped ${r.title}`);
      }
    }
  }
  const remove = text.match(/remove\s+(?:the\s+)?(.+)/);
  if (remove) {
    const needle = remove[1].trim();
    const hits = list.filter((i) => !i.locked && i.title.toLowerCase().includes(needle));
    hits.forEach((h) => changes.push(`removed ${h.title}`));
    list = list.filter((i) => !hits.includes(i));
    if (!hits.length) warnings.push(`Nothing removable matched “${needle}”.`);
  }
  if (/family|parents|kids|children|elderly/.test(text)) {
    const risky = list.filter((i) => !i.locked && i.category === "ACTIVITY");
    risky.forEach((r) => changes.push(`dropped ${r.title} (strenuous)`));
    list = list.filter((i) => !risky.includes(i));
    const friendly = unused().filter((a) => a.familyFriendly).slice(0, risky.length || 1);
    friendly.forEach((a) => addAttraction(a));
  }
  for (const [kw, cat] of Object.entries(KEYWORD_CATEGORY)) {
    if (new RegExp(`add\\b.*\\b${kw}|more\\s+${kw}`).test(text)) {
      const options = unused().filter((a) => a.category === cat);
      if (options.length) addAttraction(options[0]);
      else warnings.push(`No more ${kw} spots in our ${dest?.name ?? ""} catalogue.`);
    }
  }
  if (/add (one|a|an extra|1) day|one more day|extra day|longer/.test(text)) {
    dayCount += 1;
    unused()
      .slice(0, 3)
      .forEach((a) => addAttraction(a, dayCount));
    changes.push(`added day ${dayCount}`);
  }
  if (/(one|a) day (less|fewer|shorter)|reduce|remove (a|one|the last) day|shorter/.test(text) && dayCount > 1) {
    const last = dayCount;
    dayCount -= 1;
    list = list
      .filter((i) => i.dayNumber !== last || i.locked)
      .map((i) => (i.dayNumber === last ? { ...i, dayNumber: dayCount, position: 999 } : i));
    changes.push(`removed day ${last}`);
  }
  if (/optimi[sz]e|shorter route|less driving|reorder/.test(text)) {
    for (let d = 1; d <= dayCount; d++) {
      const day = list.filter((i) => i.dayNumber === d);
      const movable = day.filter((i): i is ProposedItem & Located => !i.locked && i.latitude != null && i.longitude != null && isActivity(i));
      if (movable.length < 3) continue;
      // Keep the day's existing time slots; just visit the stops in a shorter order.
      const slots = movable.map((i) => i.startTime).sort((a, b) => (a ?? "").localeCompare(b ?? ""));
      nearestNeighbour(movable, movable[0]).forEach((it, k) => {
        it.startTime = slots[k] ?? it.startTime;
        if (it.startTime && it.durationMinutes) it.endTime = hhmm(toMin(it.startTime) + it.durationMinutes);
      });
      changes.push(`reordered day ${d} to cut driving`);
    }
  }
  if (ctx.veg) {
    list = list.map((i) => (i.category === "RESTAURANT" && !i.locked ? { ...i, title: i.title.replace("local restaurant", "vegetarian-friendly place"), description: "Look for pure-veg or udupi-style restaurants." } : i));
    changes.push("switched meals to vegetarian-friendly places");
  }
  if (!changes.length && !warnings.length)
    warnings.push("The demo planner didn't recognise that request. Try “make it cheaper”, “less hectic”, “add a waterfall”, “remove <place>”, “add one day” or “optimize the route”.");

  const days: PlanProposal["days"] = Array.from({ length: dayCount }, (_, k) => {
    const n = k + 1;
    const its = list
      .filter((i) => i.dayNumber === n)
      .sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99") || a.position - b.position)
      .map((i, idx) => ({ ...i, position: idx }));
    return { dayNumber: n, date: trip.startDate ? addDays(trip.startDate, k) : null, title: "", items: its };
  });
  return {
    engine: DEMO_ENGINE,
    request: { ...req, days: dayCount },
    summary: changes.length ? `Proposed changes: ${changes.join("; ")}.` : "No changes proposed.",
    days,
    ...summarise(days, trip.budgetAmount ?? undefined),
    currency: trip.currency,
    tips: [],
    assumptions: ["Kept, booked and completed activities are left exactly as they are.", "Costs are estimates, not quotes."],
    warnings,
  };
}
