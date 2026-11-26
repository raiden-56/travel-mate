/**
 * In-browser implementation of docs/API.md for the static demo build. Mirrors the server's
 * rules (validation, ownership, status transitions, decimal money, protected itinerary items)
 * so the UI behaves the same; data lives in this browser only (see db.ts).
 */
import type {
  AttractionDto,
  AuthResponse,
  BudgetCategory,
  BudgetDto,
  ChecklistDto,
  ChecklistItemDto,
  DestinationDetail,
  DestinationSummary,
  ExpenseDto,
  ItineraryDto,
  ItineraryItemDto,
  ItineraryWarning,
  PageResponse,
  PlanProposal,
  PlanRequest,
  ProfileStats,
  TripDto,
  TripStatus,
  TripUpsert,
  UserDto,
} from "@/types/api";
import { BUDGET_CATEGORIES } from "@/types/api";
import { ApiError } from "@/lib/api-error";
import { fromMinor, isMoney, toMinor } from "@/lib/money";
import { addDays, daysBetweenInclusive, toIsoDate } from "@/lib/dates";
import { DEMO_ADMIN } from "./config";
import seed from "./seed.json";
import { type DemoDB, type DemoDestination, type DemoTrip, type DemoUser, freshDb, loadDb, saveDb } from "./db";
import { haversineKm, optimizeOrder, route, weather } from "./geo";
import { DEMO_ENGINE, generatePlan, modifyPlan } from "./planner";

type Query = Record<string, unknown>;
type Req = { method: string; path: string; query: Query; body: Record<string, unknown>; db: DemoDB; userId: string | null };
type Handler = (req: Req, params: string[]) => unknown | Promise<unknown>;

// ---------------------------------------------------------------- helpers
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const fail = (status: number, code: string, detail: string, errors?: { field: string; message: string }[]): never => {
  throw new ApiError({ status, code, detail, errors });
};
const notFound = (what = "Not found") => fail(404, "NOT_FOUND", what);
const invalid = (field: string, message: string) => fail(400, "VALIDATION_FAILED", message, [{ field, message }]);
const str = (v: unknown) => (v == null ? "" : String(v));
const optStr = (v: unknown) => (v == null || v === "" ? null : String(v).trim());
const num = (v: unknown, fallback: number) => (v == null || v === "" || Number.isNaN(Number(v)) ? fallback : Number(v));
const money = (v: unknown, field: string): string | null => {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!isMoney(s) || s.startsWith("-")) invalid(field, "Enter a positive amount with up to 2 decimals");
  return fromMinor(toMinor(s));
};
const sum = (values: (string | null | undefined)[]) => fromMinor(values.reduce<bigint>((a, v) => a + toMinor(v), 0n));

function paginate<T>(items: T[], q: Query): PageResponse<T> {
  const size = Math.min(100, Math.max(1, num(q.size, 20)));
  const page = Math.max(0, num(q.page, 0));
  return {
    items: items.slice(page * size, page * size + size),
    page,
    size,
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  };
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  TRAVELER: ["trip:own"],
  ADMIN: ["trip:own", "admin:access", "destination:write", "destination:publish", "user:read", "user:manage", "audit:read"],
  SUPER_ADMIN: ["trip:own", "admin:access", "destination:write", "destination:publish", "user:read", "user:manage", "audit:read", "role:manage"],
};
const permissionsOf = (u: DemoUser) => Array.from(new Set(u.roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? [])));

function userDto(u: DemoUser): UserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.profile.avatarUrl,
    emailVerified: u.emailVerified,
    status: u.status,
    roles: u.roles,
    permissions: permissionsOf(u),
    createdAt: u.createdAt,
  };
}

function currentUser(req: Req): DemoUser {
  const u = req.db.users.find((x) => x.id === req.userId);
  if (!u) fail(401, "UNAUTHORIZED", "Please sign in.");
  if (u!.status === "SUSPENDED") fail(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  return u!;
}

function requirePermission(req: Req, permission: string): DemoUser {
  const u = currentUser(req);
  if (!permissionsOf(u).includes(permission)) fail(403, "FORBIDDEN", "You don't have permission to do that.");
  return u;
}

function audit(req: Req, action: string, targetType: string | null, targetId: string | null, details: string | null) {
  const actor = req.db.users.find((u) => u.id === req.userId);
  req.db.audit.unshift({ id: uuid(), actorEmail: actor?.email ?? null, action, targetType, targetId, details, createdAt: now() });
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureDemoAdmin(db: DemoDB) {
  if (db.users.some((u) => u.email === DEMO_ADMIN.email)) return;
  const salt = uuid();
  db.users.push({
    id: uuid(),
    email: DEMO_ADMIN.email,
    displayName: DEMO_ADMIN.name,
    passwordHash: await hashPassword(DEMO_ADMIN.password, salt),
    salt,
    roles: ["SUPER_ADMIN"],
    status: "ACTIVE",
    emailVerified: true,
    createdAt: now(),
    lastLoginAt: null,
    profile: { avatarUrl: null, homeCity: null, bio: null, preferredCurrency: "INR", travelStyles: [] },
  });
}

// ---------------------------------------------------------------- destinations
const published = (db: DemoDB) => db.destinations.filter((d) => d.status === "PUBLISHED" && !d.deletedAt);
const isSaved = (db: DemoDB, userId: string | null, type: "DESTINATION" | "ATTRACTION", id: string) =>
  !!userId && db.favorites.some((f) => f.userId === userId && f.targetType === type && f.targetId === id);

function summary(d: DemoDestination, db: DemoDB, userId: string | null): DestinationSummary {
  return {
    id: d.id, slug: d.slug, name: d.name, region: d.region, state: d.state, country: d.country, summary: d.summary,
    heroImageUrl: d.heroImageUrl, heroImageCredit: d.heroImageCredit, latitude: d.latitude, longitude: d.longitude,
    categories: d.categories, recommendedDaysMin: d.recommendedDaysMin, recommendedDaysMax: d.recommendedDaysMax,
    budgetPerDayMin: d.budgetPerDayMin, budgetPerDayMax: d.budgetPerDayMax, currency: d.currency, featured: d.featured,
    seedData: d.seedData, saved: isSaved(db, userId, "DESTINATION", d.id),
  };
}

const attraction = (a: AttractionDto, db: DemoDB, userId: string | null): AttractionDto => ({ ...a, saved: isSaved(db, userId, "ATTRACTION", a.id) });

function detail(d: DemoDestination, db: DemoDB, userId: string | null): DestinationDetail {
  const mine = new Set(d.categories.map((c) => c.slug));
  const similar = published(db)
    .filter((o) => o.id !== d.id)
    .map((o) => ({ o, shared: o.categories.filter((c) => mine.has(c.slug)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.o.name.localeCompare(b.o.name))
    .slice(0, 4)
    .map((x) => summary(x.o, db, userId));
  return { ...d, ...summary(d, db, userId), attractions: d.attractions.map((a) => attraction(a, db, userId)), similar };
}

function matchesText(d: DemoDestination, q: string) {
  const t = q.toLowerCase();
  return [d.name, d.region, d.state, d.summary, ...d.categories.map((c) => c.name), ...d.attractions.map((a) => a.name)]
    .some((s) => s.toLowerCase().includes(t));
}

function findDestination(db: DemoDB, slug: string | null | undefined) {
  return slug ? db.destinations.find((d) => d.slug === slug && !d.deletedAt) ?? null : null;
}

// ---------------------------------------------------------------- trips
const TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  PLANNING: ["UPCOMING", "CANCELLED"],
  UPCOMING: ["IN_PROGRESS", "PLANNING", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["PLANNING"],
};

function ownTrip(req: Req, id: string): DemoTrip {
  const u = currentUser(req);
  const t = req.db.trips.find((x) => x.id === id && !x.deletedAt);
  // Same as the API: someone else's trip looks like it doesn't exist.
  if (!t || t.ownerId !== u.id) return notFound("Trip not found");
  return t;
}

const liveItems = (db: DemoDB, tripId: string) => db.items.filter((i) => i.tripId === tripId);
const costed = (i: ItineraryItemDto) => i.status !== "CANCELLED" && i.status !== "SKIPPED";

function tripDto(t: DemoTrip, db: DemoDB, userId: string | null): TripDto {
  const dest = findDestination(db, t.destinationSlug);
  const items = liveItems(db, t.id);
  return {
    ...t,
    destination: dest ? summary(dest, db, userId) : null,
    myRole: "OWNER",
    itemCount: items.length,
    estimatedCost: sum(items.filter(costed).map((i) => i.estimatedCost)),
    spentAmount: sum(db.expenses.filter((e) => e.tripId === t.id && e.currency === t.currency).map((e) => e.amount)),
  };
}

function applyTripUpsert(body: Partial<TripUpsert>, db: DemoDB, base?: DemoTrip) {
  const name = str(body.name ?? base?.name).trim();
  if (name.length < 2 || name.length > 120) invalid("name", "Give your trip a name (2–120 characters)");
  const dest = findDestination(db, optStr(body.destinationSlug));
  const destinationName = str(body.destinationName ?? dest?.name ?? base?.destinationName).trim();
  if (destinationName.length < 2) invalid("destinationName", "Where are you going?");
  const startDate = optStr(body.startDate);
  const endDate = optStr(body.endDate);
  if (endDate && !startDate) invalid("startDate", "Add a start date too");
  if (startDate && endDate && endDate < startDate) invalid("endDate", "End date is before the start date");
  const dayCount = startDate && endDate ? daysBetweenInclusive(startDate, endDate) : num(body.dayCount, base?.dayCount ?? 1);
  if (dayCount < 1 || dayCount > 60) invalid("dayCount", "Trips are 1–60 days");
  const travelers = num(body.travelers, base?.travelers ?? 1);
  if (travelers < 1 || travelers > 50) invalid("travelers", "Between 1 and 50 travelers");
  return {
    name,
    destinationSlug: dest?.slug ?? null,
    destinationName,
    startLocation: optStr(body.startLocation),
    startDate,
    endDate: startDate && !endDate ? addDays(startDate, dayCount - 1) : endDate,
    dayCount,
    travelers,
    tripType: (optStr(body.tripType) as TripDto["tripType"]) ?? null,
    budgetAmount: money(body.budgetAmount, "budgetAmount"),
    currency: str(body.currency || base?.currency || "INR"),
    coverImageUrl: optStr(body.coverImageUrl),
    description: optStr(body.description),
    visibility: (body.visibility as TripDto["visibility"]) ?? base?.visibility ?? "PRIVATE",
  };
}

function createTrip(req: Req, body: Partial<TripUpsert>): DemoTrip {
  const u = currentUser(req);
  const t: DemoTrip = {
    id: uuid(),
    ...applyTripUpsert(body, req.db),
    status: "PLANNING",
    archived: false,
    version: 0,
    createdAt: now(),
    updatedAt: now(),
    ownerId: u.id,
    categoryBudgets: {},
    deletedAt: null,
  };
  req.db.trips.push(t);
  return t;
}

// ---------------------------------------------------------------- itinerary
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const endOf = (i: ItineraryItemDto) =>
  i.endTime ? toMin(i.endTime) : i.startTime && i.durationMinutes ? toMin(i.startTime) + i.durationMinutes : null;

function itineraryDto(t: DemoTrip, db: DemoDB): ItineraryDto {
  const items = liveItems(db, t.id);
  const maxDay = Math.max(t.dayCount, ...items.map((i) => i.dayNumber));
  const days = Array.from({ length: maxDay }, (_, k) => {
    const n = k + 1;
    const its = items.filter((i) => i.dayNumber === n).sort((a, b) => a.position - b.position);
    return {
      dayNumber: n,
      date: t.startDate ? addDays(t.startDate, k) : null,
      items: its.map((i) => ({ ...i, date: t.startDate ? addDays(t.startDate, k) : null })),
      estimatedCost: sum(its.filter(costed).map((i) => i.estimatedCost)),
    };
  });
  const warnings: ItineraryWarning[] = [];
  for (const d of days) {
    const timed = d.items.filter((i) => i.startTime && costed(i));
    for (let k = 1; k < timed.length; k++) {
      const prev = timed[k - 1];
      const cur = timed[k];
      const prevEnd = endOf(prev);
      const gap = prevEnd == null ? null : toMin(cur.startTime!) - prevEnd;
      if (gap != null && gap < 0) {
        warnings.push({ code: "OVERLAP", severity: "WARNING", dayNumber: d.dayNumber, itemIds: [prev.id, cur.id], message: `“${prev.title}” runs into “${cur.title}”.` });
      } else if (gap != null && prev.latitude != null && cur.latitude != null) {
        const km = haversineKm({ lat: prev.latitude, lng: prev.longitude! }, { lat: cur.latitude, lng: cur.longitude! });
        const need = Math.round((km / 40) * 60);
        if (km > 100) warnings.push({ code: "LONG_TRANSFER", severity: "WARNING", dayNumber: d.dayNumber, itemIds: [prev.id, cur.id], message: `About ${Math.round(km)} km (straight line) between “${prev.title}” and “${cur.title}”.` });
        else if (need > gap + 10) warnings.push({ code: "TIGHT_TRANSFER", severity: "WARNING", dayNumber: d.dayNumber, itemIds: [prev.id, cur.id], message: `Only ${gap} min to cover roughly ${km.toFixed(1)} km (straight-line, approximate) to “${cur.title}”.` });
      }
    }
    for (const i of d.items) {
      if (i.durationMinutes != null && (i.durationMinutes > 720 || i.durationMinutes < 5))
        warnings.push({ code: "UNREALISTIC_DURATION", severity: "INFO", dayNumber: d.dayNumber, itemIds: [i.id], message: `“${i.title}” is set to ${i.durationMinutes} minutes — is that right?` });
    }
    const acts = d.items.filter((i) => costed(i) && !["RESTAURANT", "HOTEL", "REST", "TRANSPORTATION"].includes(i.category));
    if (acts.length > 6) warnings.push({ code: "DAY_OVERLOADED", severity: "WARNING", dayNumber: d.dayNumber, itemIds: acts.map((i) => i.id), message: `${acts.length} activities is a lot for one day.` });
    if (d.dayNumber > t.dayCount && d.items.length)
      warnings.push({ code: "OUT_OF_RANGE_DAY", severity: "WARNING", dayNumber: d.dayNumber, itemIds: d.items.map((i) => i.id), message: `Day ${d.dayNumber} is past the end of the trip — move these activities.` });
  }
  const total = sum(items.filter(costed).map((i) => i.estimatedCost));
  if (t.budgetAmount && toMinor(total) > toMinor(t.budgetAmount))
    warnings.push({ code: "OVER_BUDGET", severity: "WARNING", dayNumber: null, itemIds: [], message: `Planned activities (~₹${Number(total).toLocaleString("en-IN")}) are above the ₹${Number(t.budgetAmount).toLocaleString("en-IN")} budget.` });
  return { tripId: t.id, dayCount: t.dayCount, days, warnings, estimatedTotal: total, currency: t.currency };
}

function itemFields(body: Record<string, unknown>, base?: ItineraryItemDto) {
  const pick = <K extends keyof ItineraryItemDto>(k: K): ItineraryItemDto[K] | undefined =>
    (k in body ? (body[k] as ItineraryItemDto[K]) : base?.[k]);
  const title = str(pick("title")).trim();
  if (!title || title.length > 160) invalid("title", "Add a title (up to 160 characters)");
  const startTime = optStr(pick("startTime"));
  const endTime = optStr(pick("endTime"));
  if (startTime && endTime && endTime <= startTime) invalid("endTime", "End time must be after the start");
  const lat = pick("latitude");
  const lng = pick("longitude");
  if ((lat == null) !== (lng == null)) invalid("longitude", "Add both latitude and longitude, or neither");
  const duration = pick("durationMinutes") ?? (startTime && endTime ? toMin(endTime) - toMin(startTime) : null);
  return {
    title,
    description: optStr(pick("description")),
    category: pick("category") ?? "CUSTOM",
    status: pick("status") ?? "PLANNED",
    priority: pick("priority") ?? "MEDIUM",
    locationName: optStr(pick("locationName")),
    latitude: lat == null ? null : Number(lat),
    longitude: lng == null ? null : Number(lng),
    startTime,
    endTime,
    durationMinutes: duration == null ? null : Number(duration),
    estimatedCost: money(pick("estimatedCost"), "estimatedCost"),
    currency: str(pick("currency") || "INR"),
    notes: optStr(pick("notes")),
    bookingReference: optStr(pick("bookingReference")),
    transportMode: optStr(pick("transportMode")),
    attractionId: optStr(pick("attractionId")),
    locked: !!pick("locked"),
  } satisfies Partial<ItineraryItemDto>;
}

function ownItem(req: Req, id: string) {
  const item = req.db.items.find((i) => i.id === id) ?? notFound("Activity not found");
  const trip = ownTrip(req, item.tripId);
  return { item, trip };
}

function checkVersion(current: number, sent: unknown) {
  if (sent != null && Number(sent) !== current)
    fail(409, "CONFLICT", "This was changed elsewhere. Reload to see the latest version.");
}

function touchTrip(t: DemoTrip) {
  t.updatedAt = now();
}

// ---------------------------------------------------------------- budget
const ITEM_TO_BUDGET: Record<string, BudgetCategory> = {
  HOTEL: "ACCOMMODATION", RESTAURANT: "FOOD", TRANSPORTATION: "TRANSPORTATION", ATTRACTION: "ACTIVITIES",
  ACTIVITY: "ACTIVITIES", EVENT: "ACTIVITIES", SHOPPING: "SHOPPING",
};

function budgetDto(t: DemoTrip, db: DemoDB): BudgetDto {
  const items = liveItems(db, t.id).filter(costed);
  const expenses = db.expenses.filter((e) => e.tripId === t.id);
  const same = expenses.filter((e) => e.currency === t.currency);
  const spent = sum(same.map((e) => e.amount));
  const other = expenses.length - same.length;
  return {
    currency: t.currency,
    totalBudget: t.budgetAmount,
    perPersonBudget: t.budgetAmount ? fromMinor(toMinor(t.budgetAmount) / BigInt(t.travelers)) : null,
    travelers: t.travelers,
    estimatedItineraryCost: sum(items.map((i) => i.estimatedCost)),
    spent,
    remaining: t.budgetAmount ? fromMinor(toMinor(t.budgetAmount) - toMinor(spent)) : null,
    byCategory: BUDGET_CATEGORIES.map((c) => ({
      category: c,
      budget: t.categoryBudgets[c] ?? null,
      estimated: sum(items.filter((i) => (ITEM_TO_BUDGET[i.category] ?? "OTHER") === c).map((i) => i.estimatedCost)),
      spent: sum(same.filter((e) => e.category === c).map((e) => e.amount)),
    })),
    notes: [
      ...(other ? [`${other} expense(s) in other currencies are not included in totals — we don't convert with made-up rates.`] : []),
      "Planned costs come from itinerary estimates, not quotes.",
    ],
  };
}

function expenseFields(body: Record<string, unknown>, t: DemoTrip) {
  const title = str(body.title).trim();
  if (!title) invalid("title", "What was it for?");
  const amount = money(body.amount, "amount");
  if (!amount || toMinor(amount) <= 0n) invalid("amount", "Amount must be more than zero");
  const category = str(body.category) as BudgetCategory;
  if (!BUDGET_CATEGORIES.includes(category)) invalid("category", "Pick a category");
  const date = str(body.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid("date", "Pick a date");
  return {
    title,
    amount: amount!,
    currency: str(body.currency || t.currency).toUpperCase(),
    category,
    date,
    notes: optStr(body.notes),
    paymentMethod: optStr(body.paymentMethod),
  };
}

// ---------------------------------------------------------------- checklist
function checklistDto(c: { id: string; tripId: string; name: string; templateKey: string | null; items: ChecklistItemDto[] }): ChecklistDto {
  return { ...c, completedCount: c.items.filter((i) => i.completed).length, totalCount: c.items.length };
}

function ownChecklist(req: Req, id: string) {
  const c = req.db.checklists.find((x) => x.id === id) ?? notFound("Checklist not found");
  ownTrip(req, c.tripId);
  return c;
}

function ownChecklistItem(req: Req, id: string) {
  const c = req.db.checklists.find((x) => x.items.some((i) => i.id === id)) ?? notFound("Item not found");
  ownTrip(req, c.tripId);
  return { list: c, item: c.items.find((i) => i.id === id)! };
}

async function suggestChecklist(t: DemoTrip, db: DemoDB) {
  const dest = findDestination(db, t.destinationSlug);
  const cats = new Set(dest?.categories.map((c) => c.slug) ?? []);
  const items: { label: string; category: ChecklistDto["items"][number]["category"]; reason: string }[] = [
    { label: "ID card / Aadhaar", category: "DOCUMENTS", reason: "Hotels and checkpoints ask for photo ID." },
    { label: "Phone charger and power bank", category: "ELECTRONICS", reason: "Long days out with maps running." },
    { label: "Basic first-aid kit", category: "MEDICINES", reason: "Useful on any trip." },
    { label: `${Math.min(t.dayCount + 1, 7)} sets of clothes`, category: "CLOTHING", reason: `Trip is ${t.dayCount} day(s).` },
  ];
  if (cats.has("beaches")) items.push({ label: "Sunscreen SPF 50", category: "TOILETRIES", reason: `${dest!.name} is a beach destination.` }, { label: "Swimwear and quick-dry towel", category: "CLOTHING", reason: "Beach days." });
  if (cats.has("trekking") || cats.has("adventure") || cats.has("mountains")) items.push({ label: "Trekking shoes with grip", category: "ADVENTURE", reason: "Trails and rocky paths." });
  if (cats.has("hill-stations") || cats.has("mountains")) items.push({ label: "Light jacket", category: "CLOTHING", reason: "Evenings get cool at altitude." });
  if (cats.has("wildlife") || cats.has("camping")) items.push({ label: "Insect repellent", category: "TOILETRIES", reason: "Forests and campsites." });
  if (cats.has("historical") || cats.has("cultural")) items.push({ label: "Clothes covering shoulders and knees", category: "CLOTHING", reason: "Temple dress codes." });
  if (t.tripType === "FAMILY") items.push({ label: "Snacks and water for kids", category: "FOOD", reason: "Family trip." });
  let source = "rules";
  if (dest) {
    try {
      const w = await weather(dest.latitude, dest.longitude);
      source = "rules + open-meteo";
      if (w.daily.some((d) => (d.precipitationProbability ?? 0) >= 50)) items.push({ label: "Umbrella or rain jacket", category: "ESSENTIALS", reason: "Rain is likely in the 7-day forecast." });
      if (w.daily.some((d) => d.maxC >= 32)) items.push({ label: "Reusable water bottle and electrolytes", category: "ESSENTIALS", reason: "Hot days in the forecast." });
    } catch {
      /* weather is optional for suggestions */
    }
  }
  return { provenance: { source, approximate: false, simulated: false, note: "Rule-based suggestions" }, items };
}

// ---------------------------------------------------------------- proposals
function storeProposal(req: Req, p: Omit<PlanProposal, "id" | "createdAt" | "tripId">, tripId: string | null): PlanProposal {
  const proposal: PlanProposal = { ...p, id: uuid(), createdAt: now(), tripId };
  req.db.proposals = [{ ...proposal, ownerId: req.userId! }, ...req.db.proposals.filter((x) => x.ownerId === req.userId)].slice(0, 10)
    .concat(req.db.proposals.filter((x) => x.ownerId !== req.userId));
  return proposal;
}

function applyProposal(req: Req, proposal: PlanProposal, trip: DemoTrip) {
  const protectedItem = (i: ItineraryItemDto) => i.locked || i.status === "BOOKED" || i.status === "COMPLETED";
  const existing = liveItems(req.db, trip.id);
  const keepIds = new Set(proposal.days.flatMap((d) => d.items.map((i) => i.sourceItemId)).filter(Boolean));
  req.db.items = req.db.items.filter((i) => i.tripId !== trip.id || protectedItem(i) || keepIds.has(i.id));
  for (const day of proposal.days) {
    for (const p of day.items) {
      const src = p.sourceItemId ? existing.find((i) => i.id === p.sourceItemId) : undefined;
      if (src) {
        if (protectedItem(src)) continue;
        Object.assign(src, {
          dayNumber: day.dayNumber, position: p.position, title: p.title, description: p.description || null,
          startTime: p.startTime, endTime: p.endTime, durationMinutes: p.durationMinutes, estimatedCost: p.estimatedCost,
          version: src.version + 1, updatedAt: now(),
        });
        continue;
      }
      req.db.items.push({
        id: uuid(), tripId: trip.id, dayNumber: day.dayNumber, position: p.position, date: null, title: p.title,
        description: p.description || null, category: p.category, status: "PLANNED", priority: "MEDIUM",
        locationName: p.locationName, latitude: p.latitude, longitude: p.longitude, startTime: p.startTime,
        endTime: p.endTime, durationMinutes: p.durationMinutes, estimatedCost: p.estimatedCost, currency: p.currency,
        costIsEstimate: true, notes: null, bookingReference: null, transportMode: null, attractionId: p.attractionId,
        locked: false, source: "PLANNER", aiReason: p.reason || null, version: 0, createdAt: now(), updatedAt: now(),
      });
    }
  }
  if (proposal.days.length !== trip.dayCount) {
    trip.dayCount = proposal.days.length;
    if (trip.startDate) trip.endDate = addDays(trip.startDate, trip.dayCount - 1);
  }
  trip.version += 1;
  touchTrip(trip);
}

// ---------------------------------------------------------------- routes
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, handler: Handler) =>
  routes.push([method, new RegExp(`^${pattern.replace(/\{[^}]+\}/g, "([^/]+)")}$`), handler]);

// auth
async function session(req: Req, u: DemoUser): Promise<AuthResponse> {
  req.db.sessionUserId = u.id;
  u.lastLoginAt = now();
  return { accessToken: "demo-session", expiresIn: 900, user: userDto(u) };
}
on("POST", "/auth/register", async (req) => {
  const email = str(req.body.email).trim().toLowerCase();
  const password = str(req.body.password);
  const displayName = str(req.body.displayName).trim();
  const errors: { field: string; message: string }[] = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push({ field: "email", message: "Enter a valid email" });
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    errors.push({ field: "password", message: "Use 8–72 characters with a letter and a number" });
  if (displayName.length < 2 || displayName.length > 60) errors.push({ field: "displayName", message: "Use 2–60 characters" });
  if (errors.length) fail(400, "VALIDATION_FAILED", "Check the highlighted fields.", errors);
  if (req.db.users.some((u) => u.email === email)) fail(409, "EMAIL_TAKEN", "An account with this email already exists.");
  const salt = uuid();
  const u: DemoUser = {
    id: uuid(), email, displayName, salt, passwordHash: await hashPassword(password, salt), roles: ["TRAVELER"],
    status: "ACTIVE", emailVerified: false, createdAt: now(), lastLoginAt: null,
    profile: { avatarUrl: null, homeCity: null, bio: null, preferredCurrency: "INR", travelStyles: [] },
  };
  req.db.users.push(u);
  audit({ ...req, userId: u.id }, "USER_REGISTERED", "USER", u.id, null);
  return session(req, u);
});
on("POST", "/auth/login", async (req) => {
  const email = str(req.body.email).trim().toLowerCase();
  const u = req.db.users.find((x) => x.email === email);
  if (!u || (await hashPassword(str(req.body.password), u.salt)) !== u.passwordHash)
    fail(401, "INVALID_CREDENTIALS", "That email and password don't match.");
  if (u!.status === "SUSPENDED") fail(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  audit({ ...req, userId: u!.id }, "LOGIN_SUCCESS", "USER", u!.id, null);
  return session(req, u!);
});
on("POST", "/auth/refresh", (req) => {
  const u = req.db.users.find((x) => x.id === req.db.sessionUserId && x.status === "ACTIVE");
  if (!u) fail(401, "UNAUTHORIZED", "Not signed in.");
  return { accessToken: "demo-session", expiresIn: 900, user: userDto(u!) } satisfies AuthResponse;
});
on("POST", "/auth/logout", (req) => {
  req.db.sessionUserId = null;
});
on("GET", "/auth/me", (req) => userDto(currentUser(req)));
on("POST", "/auth/password/forgot", () => undefined);
on("POST", "/auth/password/reset", () => fail(400, "INVALID_TOKEN", "Password reset emails aren't sent in the demo."));
on("POST", "/auth/email/verify", () => fail(400, "INVALID_TOKEN", "Verification emails aren't sent in the demo."));

// profile
on("GET", "/profile", (req) => {
  const u = currentUser(req);
  return { displayName: u.displayName, ...u.profile };
});
on("PUT", "/profile", (req) => {
  const u = currentUser(req);
  const name = str(req.body.displayName).trim();
  if (name.length < 2 || name.length > 60) invalid("displayName", "Use 2–60 characters");
  u.displayName = name;
  u.profile = {
    avatarUrl: optStr(req.body.avatarUrl),
    homeCity: optStr(req.body.homeCity),
    bio: optStr(req.body.bio),
    preferredCurrency: str(req.body.preferredCurrency || "INR"),
    travelStyles: (req.body.travelStyles as DemoUser["profile"]["travelStyles"]) ?? [],
  };
  return { displayName: u.displayName, ...u.profile };
});
on("GET", "/profile/stats", (req) => {
  const u = currentUser(req);
  const trips = req.db.trips.filter((t) => t.ownerId === u.id && !t.deletedAt);
  const done = trips.filter((t) => t.status === "COMPLETED");
  const today = toIsoDate(new Date());
  const spending = new Map<string, bigint>();
  for (const e of req.db.expenses.filter((x) => trips.some((t) => t.id === x.tripId)))
    spending.set(e.currency, (spending.get(e.currency) ?? 0n) + toMinor(e.amount));
  return {
    tripsTotal: trips.length,
    tripsUpcoming: trips.filter((t) => t.status === "UPCOMING" || (t.startDate && t.startDate >= today && t.status === "PLANNING")).length,
    tripsCompleted: done.length,
    destinationsVisited: new Set(done.map((t) => t.destinationSlug ?? t.destinationName)).size,
    totalTravelDays: done.reduce((a, t) => a + t.dayCount, 0),
    savedPlaces: req.db.favorites.filter((f) => f.userId === u.id).length,
    spending: Array.from(spending, ([currency, minor]) => ({ currency, amount: fromMinor(minor) })),
  } satisfies ProfileStats;
});

// destinations
on("GET", "/destinations", (req) => {
  const q = req.query;
  let list = published(req.db);
  if (q.q) list = list.filter((d) => matchesText(d, str(q.q)));
  if (q.category) list = list.filter((d) => d.categories.some((c) => c.slug === q.category));
  if (q.budgetMax) list = list.filter((d) => toMinor(d.budgetPerDayMin) <= toMinor(str(q.budgetMax)));
  if (q.maxDays) list = list.filter((d) => d.recommendedDaysMin <= num(q.maxDays, 99));
  if (q.featured === true || q.featured === "true") list = list.filter((d) => d.featured);
  const sort = str(q.sort || "featured");
  list = [...list].sort((a, b) =>
    sort === "budget"
      ? Number(toMinor(a.budgetPerDayMin) - toMinor(b.budgetPerDayMin)) || a.name.localeCompare(b.name)
      : sort === "name"
        ? a.name.localeCompare(b.name)
        : Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name),
  );
  return paginate(list.map((d) => summary(d, req.db, req.userId)), q);
});
on("GET", "/destinations/categories", (req) => req.db.categories);
on("GET", "/destinations/nearby", (req) => {
  const here = { lat: num(req.query.lat, 0), lng: num(req.query.lng, 0) };
  const radius = Math.min(1000, num(req.query.radiusKm, 300));
  return published(req.db)
    .map((d) => ({ d, km: haversineKm(here, { lat: d.latitude, lng: d.longitude }) }))
    .filter((x) => x.km <= radius)
    .sort((a, b) => a.km - b.km)
    .map((x) => ({ ...summary(x.d, req.db, req.userId), distanceKm: Math.round(x.km * 10) / 10 }));
});
on("GET", "/destinations/{slug}/weather", async (req, [slug]) => {
  const d = published(req.db).find((x) => x.slug === slug) ?? notFound();
  return weather(d.latitude, d.longitude);
});
on("GET", "/destinations/{slug}", (req, [slug]) => detail(published(req.db).find((d) => d.slug === slug) ?? notFound("Destination not found"), req.db, req.userId));
on("GET", "/attractions/{id}", (req, [id]) => {
  const a = published(req.db).flatMap((d) => d.attractions).find((x) => x.id === id) ?? notFound();
  return attraction(a, req.db, req.userId);
});

// search
on("GET", "/search", (req) => {
  const q = str(req.query.q).trim().toLowerCase();
  if (q.length < 2) invalid("q", "Type at least two letters");
  const dests = published(req.db);
  return {
    destinations: dests.filter((d) => matchesText(d, q)).slice(0, 12).map((d) => summary(d, req.db, req.userId)),
    attractions: dests
      .flatMap((d) => d.attractions)
      .filter((a) => [a.name, a.category, a.description, ...a.tags].some((s) => s.toLowerCase().includes(q)))
      .slice(0, 20)
      .map((a) => attraction(a, req.db, req.userId)),
  };
});
on("GET", "/search/suggest", (req) => {
  const q = str(req.query.q).trim().toLowerCase();
  if (q.length < 2) return [];
  const dests = published(req.db);
  return [
    ...dests.filter((d) => d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q))
      .map((d) => ({ type: "DESTINATION", label: d.name, sublabel: `${d.region}, ${d.state}`, slug: d.slug, destinationSlug: null })),
    ...req.db.categories.filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({ type: "CATEGORY", label: c.name, sublabel: "Category", slug: c.slug, destinationSlug: null })),
    ...dests.flatMap((d) => d.attractions.filter((a) => a.name.toLowerCase().includes(q))
      .map((a) => ({ type: "ATTRACTION", label: a.name, sublabel: d.name, slug: a.slug, destinationSlug: d.slug }))),
  ].slice(0, 8);
});
on("GET", "/search/popular", (req) => req.db.popular);

// favorites
on("GET", "/favorites", (req) => {
  const u = currentUser(req);
  const dests = published(req.db);
  return req.db.favorites
    .filter((f) => f.userId === u.id)
    .map((f) => {
      const destination = f.targetType === "DESTINATION" ? dests.find((d) => d.id === f.targetId) : undefined;
      const a = f.targetType === "ATTRACTION" ? dests.flatMap((d) => d.attractions).find((x) => x.id === f.targetId) : undefined;
      return {
        ...f,
        destination: destination ? summary(destination, req.db, u.id) : null,
        attraction: a ? attraction(a, req.db, u.id) : null,
      };
    })
    .filter((f) => f.destination || f.attraction);
});
on("POST", "/favorites", (req) => {
  const u = currentUser(req);
  const targetType = str(req.body.targetType) as "DESTINATION" | "ATTRACTION";
  const targetId = str(req.body.targetId);
  const exists = targetType === "DESTINATION"
    ? published(req.db).some((d) => d.id === targetId)
    : published(req.db).some((d) => d.attractions.some((a) => a.id === targetId));
  if (!exists) notFound();
  const found = req.db.favorites.find((f) => f.userId === u.id && f.targetType === targetType && f.targetId === targetId);
  if (found) return found;
  const fav = { id: uuid(), userId: u.id, targetType, targetId, createdAt: now() };
  req.db.favorites.push(fav);
  return fav;
});
on("DELETE", "/favorites/{type}/{id}", (req, [type, id]) => {
  const u = currentUser(req);
  req.db.favorites = req.db.favorites.filter((f) => !(f.userId === u.id && f.targetType === type && f.targetId === id));
});

// trips
on("GET", "/trips", (req) => {
  const u = currentUser(req);
  const archived = req.query.archived === true || req.query.archived === "true";
  return req.db.trips
    .filter((t) => t.ownerId === u.id && !t.deletedAt && t.archived === archived && (!req.query.status || t.status === req.query.status))
    .sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999") || b.updatedAt.localeCompare(a.updatedAt))
    .map((t) => tripDto(t, req.db, u.id));
});
on("POST", "/trips", (req) => tripDto(createTrip(req, req.body as Partial<TripUpsert>), req.db, req.userId));
on("GET", "/trips/{id}", (req, [id]) => tripDto(ownTrip(req, id), req.db, req.userId));
on("PUT", "/trips/{id}", (req, [id]) => {
  const t = ownTrip(req, id);
  checkVersion(t.version, req.body.version);
  Object.assign(t, applyTripUpsert(req.body as Partial<TripUpsert>, req.db, t));
  t.version += 1;
  touchTrip(t);
  return tripDto(t, req.db, req.userId);
});
on("DELETE", "/trips/{id}", (req, [id]) => {
  ownTrip(req, id).deletedAt = now();
});
on("POST", "/trips/{id}/duplicate", (req, [id]) => {
  const t = ownTrip(req, id);
  const copy: DemoTrip = { ...structuredClone(t), id: uuid(), name: `${t.name} (copy)`, status: "PLANNING", archived: false, version: 0, createdAt: now(), updatedAt: now() };
  req.db.trips.push(copy);
  for (const i of liveItems(req.db, t.id))
    req.db.items.push({ ...structuredClone(i), id: uuid(), tripId: copy.id, status: i.status === "COMPLETED" || i.status === "BOOKED" ? "PLANNED" : i.status, version: 0, createdAt: now(), updatedAt: now() });
  return tripDto(copy, req.db, req.userId);
});
on("POST", "/trips/{id}/status", (req, [id]) => {
  const t = ownTrip(req, id);
  const next = str(req.body.status) as TripStatus;
  if (!TRANSITIONS[t.status].includes(next)) fail(409, "INVALID_TRANSITION", `A ${t.status.toLowerCase()} trip can't move to ${next.toLowerCase()}.`);
  if (next === "UPCOMING" && !t.startDate) invalid("startDate", "Add travel dates first");
  t.status = next;
  t.version += 1;
  touchTrip(t);
  return tripDto(t, req.db, req.userId);
});
on("POST", "/trips/{id}/archive", (req, [id]) => {
  const t = ownTrip(req, id);
  t.archived = true;
  touchTrip(t);
  return tripDto(t, req.db, req.userId);
});
on("POST", "/trips/{id}/unarchive", (req, [id]) => {
  const t = ownTrip(req, id);
  t.archived = false;
  touchTrip(t);
  return tripDto(t, req.db, req.userId);
});

// itinerary
on("GET", "/trips/{id}/itinerary", (req, [id]) => itineraryDto(ownTrip(req, id), req.db));
on("POST", "/trips/{id}/itinerary", (req, [id]) => {
  const t = ownTrip(req, id);
  const day = num(req.body.dayNumber, 1);
  if (day < 1 || day > t.dayCount) invalid("dayNumber", `Pick a day between 1 and ${t.dayCount}`);
  const dayItems = liveItems(req.db, id).filter((i) => i.dayNumber === day);
  const item: ItineraryItemDto = {
    id: uuid(), tripId: id, dayNumber: day, position: num(req.body.position, dayItems.length), date: null,
    ...itemFields(req.body), costIsEstimate: true, source: "USER", aiReason: null, version: 0, createdAt: now(), updatedAt: now(),
  };
  req.db.items.push(item);
  touchTrip(t);
  return item;
});
on("PUT", "/itinerary/{id}", (req, [id]) => {
  const { item, trip } = ownItem(req, id);
  checkVersion(item.version, req.body.version);
  const day = num(req.body.dayNumber, item.dayNumber);
  if (day < 1 || day > Math.max(trip.dayCount, item.dayNumber)) invalid("dayNumber", `Pick a day between 1 and ${trip.dayCount}`);
  if (day !== item.dayNumber) item.position = liveItems(req.db, trip.id).filter((i) => i.dayNumber === day).length;
  Object.assign(item, itemFields(req.body, item), { dayNumber: day, version: item.version + 1, updatedAt: now() });
  touchTrip(trip);
  return item;
});
on("DELETE", "/itinerary/{id}", (req, [id]) => {
  const { item, trip } = ownItem(req, id);
  req.db.items = req.db.items.filter((i) => i !== item);
  touchTrip(trip);
});
on("POST", "/itinerary/{id}/duplicate", (req, [id]) => {
  const { item, trip } = ownItem(req, id);
  const copy = { ...structuredClone(item), id: uuid(), status: "PLANNED" as const, locked: false, position: item.position + 1, version: 0, createdAt: now(), updatedAt: now() };
  liveItems(req.db, trip.id).filter((i) => i.dayNumber === item.dayNumber && i.position > item.position).forEach((i) => (i.position += 1));
  req.db.items.push(copy);
  touchTrip(trip);
  return copy;
});
on("PUT", "/trips/{id}/itinerary/order", (req, [id]) => {
  const t = ownTrip(req, id);
  const days = (req.body.days as { dayNumber: number; itemIds: string[] }[]) ?? [];
  const mine = new Map(liveItems(req.db, id).map((i) => [i.id, i]));
  for (const d of days) {
    if (d.dayNumber < 1 || d.dayNumber > Math.max(t.dayCount, ...[...mine.values()].map((i) => i.dayNumber))) invalid("days", "Unknown day");
    d.itemIds.forEach((itemId, position) => {
      const it = mine.get(itemId) ?? invalid("days", "Unknown activity");
      Object.assign(it, { dayNumber: d.dayNumber, position, updatedAt: now() });
    });
  }
  touchTrip(t);
  return itineraryDto(t, req.db);
});

// AI planner
on("GET", "/ai/status", () => ({ engine: DEMO_ENGINE.id, label: DEMO_ENGINE.label, model: null, simulated: true }));
on("POST", "/ai/trip-planner/generate", (req) => {
  currentUser(req);
  const body = req.body as unknown as PlanRequest;
  const dest = findDestination(req.db, body.destinationSlug);
  if (!dest || dest.status !== "PUBLISHED") invalid("destinationSlug", "Choose one of our destinations");
  const days = num(body.days, 0);
  if (days < 1 || days > 14) invalid("days", "Plan between 1 and 14 days");
  const travelers = num(body.travelers, 0);
  if (travelers < 1 || travelers > 20) invalid("travelers", "Between 1 and 20 travelers");
  const request: PlanRequest = { ...body, days, travelers, budget: money(body.budget, "budget") ?? undefined, styles: body.styles ?? [], interests: body.interests ?? [], pace: body.pace ?? "BALANCED" };
  return storeProposal(req, generatePlan(request, dest!), null);
});
on("POST", "/ai/trip-planner/modify", (req) => {
  const trip = ownTrip(req, str(req.body.tripId));
  const instruction = str(req.body.instruction).trim();
  if (!instruction || instruction.length > 500) invalid("instruction", "Describe the change in up to 500 characters");
  const p = modifyPlan(instruction, trip, liveItems(req.db, trip.id), findDestination(req.db, trip.destinationSlug));
  return storeProposal(req, p, trip.id);
});
on("POST", "/ai/trip-planner/proposals/{id}/apply", (req, [pid]) => {
  const u = currentUser(req);
  const proposal = req.db.proposals.find((p) => p.id === pid && p.ownerId === u.id) ?? notFound("Proposal not found or expired");
  let trip: DemoTrip;
  if (req.body.tripId) trip = ownTrip(req, str(req.body.tripId));
  else if (req.body.trip) trip = createTrip(req, { ...(req.body.trip as Partial<TripUpsert>), dayCount: proposal.days.length });
  else return invalid("tripId", "Choose a trip to apply this plan to");
  applyProposal(req, proposal, trip);
  req.db.proposals = req.db.proposals.filter((p) => p.id !== pid);
  return tripDto(trip, req.db, u.id);
});

// maps
const points = (req: Req) => {
  const pts = (req.body.points as { lat: number; lng: number }[]) ?? [];
  if (pts.length < 2 || pts.length > 25) invalid("points", "Between 2 and 25 points");
  return pts;
};
on("POST", "/maps/route", (req) => route(points(req)));
on("POST", "/maps/optimize", (req) => optimizeOrder(points(req), req.body.keepFirst !== false, req.body.keepLast === true));

// budget & expenses
on("GET", "/trips/{id}/budget", (req, [id]) => budgetDto(ownTrip(req, id), req.db));
on("PUT", "/trips/{id}/budget", (req, [id]) => {
  const t = ownTrip(req, id);
  t.budgetAmount = money(req.body.totalBudget, "totalBudget");
  const cats = (req.body.categoryBudgets as Record<string, unknown>) ?? {};
  t.categoryBudgets = Object.fromEntries(
    Object.entries(cats).flatMap(([k, v]) => {
      const m = money(v, `categoryBudgets.${k}`);
      return m && BUDGET_CATEGORIES.includes(k as BudgetCategory) ? [[k, m]] : [];
    }),
  );
  t.version += 1;
  touchTrip(t);
  return budgetDto(t, req.db);
});
on("GET", "/trips/{id}/expenses", (req, [id]) => {
  ownTrip(req, id);
  return req.db.expenses.filter((e) => e.tripId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
});
on("POST", "/trips/{id}/expenses", (req, [id]) => {
  const t = ownTrip(req, id);
  const u = currentUser(req);
  const clientRequestId = optStr(req.body.clientRequestId);
  const dup = clientRequestId && req.db.expenses.find((e) => e.tripId === id && e.clientRequestId === clientRequestId);
  if (dup) return dup;
  const e: ExpenseDto = {
    id: uuid(), tripId: id, ...expenseFields(req.body, t), paidByUserId: u.id, paidByName: u.displayName,
    clientRequestId, createdAt: now(), updatedAt: now(), version: 0,
  };
  req.db.expenses.push(e);
  return e;
});
on("PUT", "/expenses/{id}", (req, [id]) => {
  const e = req.db.expenses.find((x) => x.id === id) ?? notFound("Expense not found");
  const t = ownTrip(req, e.tripId);
  checkVersion(e.version, req.body.version);
  Object.assign(e, expenseFields(req.body, t), { version: e.version + 1, updatedAt: now() });
  return e;
});
on("DELETE", "/expenses/{id}", (req, [id]) => {
  const e = req.db.expenses.find((x) => x.id === id) ?? notFound("Expense not found");
  ownTrip(req, e.tripId);
  req.db.expenses = req.db.expenses.filter((x) => x !== e);
});

// checklists
on("GET", "/checklist-templates", (req) => req.db.templates);
on("GET", "/trips/{id}/checklists", (req, [id]) => {
  ownTrip(req, id);
  return req.db.checklists.filter((c) => c.tripId === id).map(checklistDto);
});
on("POST", "/trips/{id}/checklists", (req, [id]) => {
  ownTrip(req, id);
  const name = str(req.body.name).trim();
  if (!name || name.length > 80) invalid("name", "Name the checklist (up to 80 characters)");
  const tpl = req.db.templates.find((t) => t.key === req.body.templateKey);
  const list = {
    id: uuid(), tripId: id, name, templateKey: tpl?.key ?? null,
    items: (tpl?.items ?? []).map((i, position) => ({ id: uuid(), label: i.label, category: i.category, completed: false, position, suggested: false, reason: null })),
  };
  req.db.checklists.push(list);
  return checklistDto(list);
});
on("POST", "/trips/{id}/checklists/suggest", (req, [id]) => suggestChecklist(ownTrip(req, id), req.db));
on("DELETE", "/checklists/{id}", (req, [id]) => {
  const c = ownChecklist(req, id);
  req.db.checklists = req.db.checklists.filter((x) => x !== c);
});
on("POST", "/checklists/{id}/items", (req, [id]) => {
  const c = ownChecklist(req, id);
  const label = str(req.body.label).trim();
  if (!label || label.length > 160) invalid("label", "Add an item (up to 160 characters)");
  const item: ChecklistItemDto = {
    id: uuid(), label, category: (req.body.category as ChecklistItemDto["category"]) ?? "OTHER", completed: false,
    position: c.items.length, suggested: !!req.body.suggested, reason: optStr(req.body.reason),
  };
  c.items.push(item);
  return item;
});
on("PUT", "/checklist-items/{id}", (req, [id]) => {
  const { item } = ownChecklistItem(req, id);
  if ("label" in req.body) {
    const label = str(req.body.label).trim();
    if (!label) invalid("label", "Item can't be empty");
    item.label = label;
  }
  if ("category" in req.body) item.category = req.body.category as ChecklistItemDto["category"];
  if ("completed" in req.body) item.completed = !!req.body.completed;
  return item;
});
on("DELETE", "/checklist-items/{id}", (req, [id]) => {
  const { list, item } = ownChecklistItem(req, id);
  list.items = list.items.filter((i) => i !== item);
});

// admin
on("GET", "/admin/stats", (req) => {
  requirePermission(req, "admin:access");
  const db = req.db;
  const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const trips = db.trips.filter((t) => !t.deletedAt);
  return {
    totalUsers: db.users.length,
    activeUsers30d: db.users.filter((u) => u.lastLoginAt && u.lastLoginAt >= since(30)).length,
    newUsers7d: db.users.filter((u) => u.createdAt >= since(7)).length,
    totalTrips: trips.length,
    upcomingTrips: trips.filter((t) => t.status === "UPCOMING").length,
    completedTrips: trips.filter((t) => t.status === "COMPLETED").length,
    destinationsPublished: db.destinations.filter((d) => !d.deletedAt && d.status === "PUBLISHED").length,
    destinationsDraft: db.destinations.filter((d) => !d.deletedAt && d.status === "DRAFT").length,
  };
});
const adminDest = (req: Req, id: string) => {
  requirePermission(req, "destination:write");
  return req.db.destinations.find((d) => d.id === id && !d.deletedAt) ?? notFound("Destination not found");
};
on("GET", "/admin/destinations", (req) => {
  requirePermission(req, "destination:write");
  const q = str(req.query.q).toLowerCase();
  const list = req.db.destinations
    .filter((d) => !d.deletedAt && (!req.query.status || d.status === req.query.status) && (!q || matchesText(d, q)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((d) => ({ ...summary(d, req.db, req.userId), status: d.status, updatedAt: d.updatedAt }));
  return paginate(list, req.query);
});
on("GET", "/admin/destinations/{id}", (req, [id]) => detail(adminDest(req, id), req.db, req.userId));

function destinationFields(req: Req, body: Record<string, unknown>, selfId?: string) {
  const slug = str(body.slug).trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) invalid("slug", "Lowercase words separated by hyphens");
  if (req.db.destinations.some((d) => d.slug === slug && d.id !== selfId && !d.deletedAt)) fail(409, "SLUG_TAKEN", "Another destination uses this slug.", [{ field: "slug", message: "Already in use" }]);
  const cats = ((body.categorySlugs as string[]) ?? []).map((s) => req.db.categories.find((c) => c.slug === s)).filter((c): c is NonNullable<typeof c> => !!c);
  if (!cats.length) invalid("categorySlugs", "Pick at least one category");
  return {
    slug, name: str(body.name).trim(), region: str(body.region), state: str(body.state), country: str(body.country),
    summary: str(body.summary), description: str(body.description), heroImageUrl: optStr(body.heroImageUrl),
    heroImageCredit: optStr(body.heroImageCredit), latitude: num(body.latitude, 0), longitude: num(body.longitude, 0),
    categories: cats, recommendedDaysMin: num(body.recommendedDaysMin, 1), recommendedDaysMax: num(body.recommendedDaysMax, 2),
    budgetPerDayMin: money(body.budgetPerDayMin, "budgetPerDayMin") ?? "0.00", budgetPerDayMax: money(body.budgetPerDayMax, "budgetPerDayMax") ?? "0.00",
    currency: "INR", bestTimeToVisit: str(body.bestTimeToVisit), howToReach: str(body.howToReach), localTransport: str(body.localTransport),
    travelTips: (body.travelTips as string[]) ?? [], safetyInfo: str(body.safetyInfo), faqs: (body.faqs as DemoDestination["faqs"]) ?? [],
    gallery: (body.gallery as DemoDestination["gallery"]) ?? [], featured: !!body.featured, seoTitle: optStr(body.seoTitle),
    seoDescription: optStr(body.seoDescription), updatedAt: now(),
  };
}
on("POST", "/admin/destinations", (req) => {
  requirePermission(req, "destination:write");
  const d: DemoDestination = { id: uuid(), ...destinationFields(req, req.body), attractions: [], status: "DRAFT", seedData: false, deletedAt: null };
  req.db.destinations.push(d);
  audit(req, "DESTINATION_CREATED", "DESTINATION", d.id, d.name);
  return detail(d, req.db, req.userId);
});
on("PUT", "/admin/destinations/{id}", (req, [id]) => {
  const d = adminDest(req, id);
  Object.assign(d, destinationFields(req, req.body, id));
  audit(req, "DESTINATION_UPDATED", "DESTINATION", d.id, d.name);
  return detail(d, req.db, req.userId);
});
on("DELETE", "/admin/destinations/{id}", (req, [id]) => {
  const d = adminDest(req, id);
  d.deletedAt = now();
  audit(req, "DESTINATION_DELETED", "DESTINATION", d.id, d.name);
});
for (const action of ["publish", "unpublish"] as const) {
  on("POST", `/admin/destinations/{id}/${action}`, (req, [id]) => {
    requirePermission(req, "destination:publish");
    const d = adminDest(req, id);
    if (action === "publish" && d.attractions.length === 0) fail(409, "NO_ATTRACTIONS", "Add at least one place before publishing.");
    d.status = action === "publish" ? "PUBLISHED" : "DRAFT";
    d.updatedAt = now();
    audit(req, action === "publish" ? "DESTINATION_PUBLISHED" : "DESTINATION_UNPUBLISHED", "DESTINATION", d.id, d.name);
    return detail(d, req.db, req.userId);
  });
}
function attractionFields(body: Record<string, unknown>) {
  const name = str(body.name).trim();
  if (name.length < 2) invalid("name", "Add a name");
  return {
    name, slug: str(body.slug), category: str(body.category) as AttractionDto["category"], description: str(body.description),
    latitude: num(body.latitude, 0), longitude: num(body.longitude, 0), typicalDurationMinutes: num(body.typicalDurationMinutes, 60),
    costMin: money(body.costMin, "costMin") ?? "0.00", costMax: money(body.costMax, "costMax") ?? "0.00", currency: "INR",
    costNote: optStr(body.costNote), bestTimeOfDay: (str(body.bestTimeOfDay) || "ANY") as AttractionDto["bestTimeOfDay"],
    openingHoursNote: optStr(body.openingHoursNote), openingHoursVerified: !!body.openingHoursVerified,
    tags: (body.tags as string[]) ?? [], familyFriendly: !!body.familyFriendly, accessibilityNote: optStr(body.accessibilityNote),
  };
}
on("POST", "/admin/destinations/{id}/attractions", (req, [id]) => {
  const d = adminDest(req, id);
  const a: AttractionDto = { id: uuid(), destinationId: d.id, destinationSlug: d.slug, seedData: false, saved: false, ...attractionFields(req.body) };
  d.attractions.push(a);
  d.updatedAt = now();
  audit(req, "ATTRACTION_CREATED", "ATTRACTION", a.id, a.name);
  return a;
});
const findAttraction = (req: Req, id: string) => {
  requirePermission(req, "destination:write");
  const d = req.db.destinations.find((x) => x.attractions.some((a) => a.id === id)) ?? notFound("Place not found");
  return { d, a: d.attractions.find((a) => a.id === id)! };
};
on("PUT", "/admin/attractions/{id}", (req, [id]) => {
  const { d, a } = findAttraction(req, id);
  Object.assign(a, attractionFields(req.body));
  d.updatedAt = now();
  audit(req, "ATTRACTION_UPDATED", "ATTRACTION", a.id, a.name);
  return a;
});
on("DELETE", "/admin/attractions/{id}", (req, [id]) => {
  const { d, a } = findAttraction(req, id);
  d.attractions = d.attractions.filter((x) => x !== a);
  d.updatedAt = now();
  audit(req, "ATTRACTION_DELETED", "ATTRACTION", a.id, a.name);
});
on("GET", "/admin/users", (req) => {
  requirePermission(req, "user:read");
  const q = str(req.query.q).toLowerCase();
  const list = req.db.users
    .filter((u) => (!req.query.status || u.status === req.query.status) && (!q || u.email.includes(q) || u.displayName.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((u) => ({ ...userDto(u), tripCount: req.db.trips.filter((t) => t.ownerId === u.id && !t.deletedAt).length, lastLoginAt: u.lastLoginAt }));
  return paginate(list, req.query);
});
for (const action of ["suspend", "reactivate"] as const) {
  on("POST", `/admin/users/{id}/${action}`, (req, [id]) => {
    const me = requirePermission(req, "user:manage");
    const target = req.db.users.find((u) => u.id === id) ?? notFound("User not found");
    if (target.id === me.id) fail(409, "CANNOT_TARGET_SELF", "You can't change your own account status.");
    if (target.roles.includes("SUPER_ADMIN") && !me.roles.includes("SUPER_ADMIN")) fail(403, "FORBIDDEN", "Only a super admin can do that.");
    const reason = str(req.body.reason).trim();
    if (reason.length < 3) invalid("reason", "Give a reason (it's recorded in the audit log)");
    target.status = action === "suspend" ? "SUSPENDED" : "ACTIVE";
    audit(req, action === "suspend" ? "USER_SUSPENDED" : "USER_REACTIVATED", "USER", target.id, reason);
    return userDto(target);
  });
}
on("GET", "/admin/audit-logs", (req) => {
  requirePermission(req, "audit:read");
  return paginate(req.db.audit, req.query);
});

// ---------------------------------------------------------------- entry points
async function dispatch(db: DemoDB, method: string, path: string, query: Query, body: unknown) {
  for (const [m, re, handler] of routes) {
    if (m !== method) continue;
    const match = re.exec(path);
    if (match) {
      const req: Req = { method, path, query, body: (body as Record<string, unknown>) ?? {}, db, userId: db.sessionUserId };
      return handler(req, match.slice(1).map(decodeURIComponent));
    }
  }
  return notFound(`No demo handler for ${method} ${path}`);
}

/** Browser entry point used by lib/api-client in demo builds. Persists changes after each successful call. */
export async function demoRequest<T>(method: string, path: string, query: Query = {}, body?: unknown): Promise<T> {
  const db = loadDb();
  await ensureDemoAdmin(db);
  const snapshot = JSON.stringify(db);
  try {
    const result = await dispatch(db, method, path, query, body);
    if (method !== "GET") saveDb(db);
    return structuredClone(result) as T;
  } catch (e) {
    // Roll back partial writes so a failed request leaves no trace, like a DB transaction.
    if (method !== "GET") saveDb(JSON.parse(snapshot) as DemoDB);
    throw e;
  }
}

/** Server-side (build-time) read access for static pages: anonymous, seed data only. */
export async function demoServerGet<T>(pathWithQuery: string): Promise<T> {
  const url = new URL(pathWithQuery, "http://demo.local");
  return (await dispatch(freshDb(), "GET", url.pathname, Object.fromEntries(url.searchParams), undefined)) as T;
}

/** Destination slugs to pre-render in the static build. */
export function seedSlugs(): string[] {
  return seed.destinations.map((d) => d.slug);
}
