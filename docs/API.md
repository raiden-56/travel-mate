# TravelMate API contract — v1

Base path `/api/v1`. JSON everywhere. This file is the contract both `travelmate-api` and
`travelmate-web` build against; change it first, then the code. Live spec: `/v3/api-docs`,
UI: `/swagger-ui.html`.

## Deviations

Implemented by `travelmate-api`; all are **additive** (no field removed or renamed):

1. `BudgetDto` has an extra `notes: string[]` (e.g. "N expense(s) in other currencies are not included in
   totals…", "Itinerary costs are estimates…"). This is the "note" for other-currency expenses.
2. `ProposedItem` has an extra `sourceItemId: string | null` — the id of the existing itinerary item it carries
   over (modify proposals). On apply, items with a `sourceItemId` update that item in place instead of creating
   a new one; protected (locked/BOOKED/COMPLETED) items are never touched.
3. `POST /favorites` returns the created/existing favorite object (same shape as one `GET /favorites` entry).
4. Itinerary `TIGHT_TRANSFER` / `LONG_TRANSFER` checks always use straight-line distance (labelled
   approximate in the message) so `GET /itinerary` never makes external calls.
5. `MapDtos` route `durationMinutes` (total and per leg) is a JSON number such as `12.0`, or `null` for
   straight-line results.

## Conventions

- Ids are UUID strings. Dates `YYYY-MM-DD`, times `HH:mm`, instants ISO-8601 UTC.
- Money is a **string** decimal with 2 places (`"12500.00"`) plus a `currency` (ISO 4217, default `INR`).
  Never send or parse money as a JS number.
- Auth: `Authorization: Bearer <accessToken>`. Refresh token is an `HttpOnly` cookie
  `tm_refresh` (path `/api/v1/auth`, `SameSite=Strict`, `Secure` outside local).
  Cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`) also require header
  `X-Requested-With: travelmate` (CSRF guard).
- Paged lists: query `page` (0-based), `size` (default 20, max 100), `sort`.
  Response:
  ```ts
  type PageResponse<T> = { items: T[]; page: number; size: number; totalItems: number; totalPages: number }
  ```
- Errors: RFC 7807 `application/problem+json`
  ```ts
  type ApiProblem = { type: string; title: string; status: number; detail: string;
                      code: string;               // stable machine code, e.g. VALIDATION_FAILED, NOT_FOUND, FORBIDDEN, CONFLICT, RATE_LIMITED, EMAIL_TAKEN, INVALID_CREDENTIALS, PROVIDER_UNAVAILABLE
                      errors?: { field: string; message: string }[] }
  ```
  Stack traces are never returned.
- Data provenance on integration-backed responses:
  ```ts
  type Provenance = { source: string; approximate: boolean; simulated: boolean; note?: string }
  ```

## Shared DTOs

```ts
type UserDto = { id: string; email: string; displayName: string; avatarUrl: string | null;
                 emailVerified: boolean; status: 'ACTIVE' | 'SUSPENDED';
                 roles: string[]; permissions: string[]; createdAt: string }

type AuthResponse = { accessToken: string; expiresIn: number /* seconds */; user: UserDto }

type ProfileDto = { displayName: string; avatarUrl: string | null; homeCity: string | null; bio: string | null;
                    preferredCurrency: string; travelStyles: TravelStyle[] }

type TravelStyle = 'RELAXED'|'ADVENTURE'|'BUDGET'|'LUXURY'|'NATURE'|'FOOD'|'PHOTOGRAPHY'|'FAMILY'|'COUPLE'|'BACKPACKING'|'CULTURAL'|'ROAD_TRIP'

type CategoryDto = { slug: string; name: string }

type DestinationSummary = {
  id: string; slug: string; name: string; region: string; state: string; country: string;
  summary: string; heroImageUrl: string | null; heroImageCredit: string | null;
  latitude: number; longitude: number;
  categories: CategoryDto[];
  recommendedDaysMin: number; recommendedDaysMax: number;
  budgetPerDayMin: string; budgetPerDayMax: string; currency: string;   // per person, estimate
  featured: boolean; seedData: boolean; saved: boolean /* false when anonymous */ }

type AttractionDto = {
  id: string; slug: string; destinationId: string; destinationSlug: string; name: string;
  category: AttractionCategory; description: string; latitude: number; longitude: number;
  typicalDurationMinutes: number; costMin: string; costMax: string; currency: string; costNote: string | null;
  bestTimeOfDay: 'MORNING'|'AFTERNOON'|'EVENING'|'ANY';
  openingHoursNote: string | null; openingHoursVerified: boolean;
  tags: string[]; familyFriendly: boolean; accessibilityNote: string | null;
  seedData: boolean; saved: boolean }

type AttractionCategory = 'BEACH'|'TEMPLE'|'WATERFALL'|'FORT'|'VIEWPOINT'|'MUSEUM'|'ADVENTURE'|'NATURE'|'WILDLIFE'|'MARKET'|'ISLAND'|'HERITAGE'|'RESTAURANT'|'CAFE'|'OTHER'

type DestinationDetail = DestinationSummary & {
  description: string; bestTimeToVisit: string; howToReach: string; localTransport: string;
  travelTips: string[]; safetyInfo: string; faqs: { question: string; answer: string }[];
  gallery: { url: string; credit: string | null; alt: string }[];
  attractions: AttractionDto[]; similar: DestinationSummary[];
  seoTitle: string | null; seoDescription: string | null; status: 'DRAFT'|'PUBLISHED'; updatedAt: string }
```

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password (8–72, letter+digit), displayName (2–60) }` | 201 `AuthResponse` + cookie |
| POST | `/auth/login` | `{ email, password }` | 200 `AuthResponse` + cookie; 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_SUSPENDED` |
| POST | `/auth/refresh` | — (cookie) | 200 `AuthResponse` + rotated cookie; 401 |
| POST | `/auth/logout` | — (cookie) | 204, revokes refresh token family |
| GET | `/auth/me` | — | `UserDto` |
| POST | `/auth/password/forgot` | `{ email }` | 202 always (no account enumeration). Dev: reset link logged by `LoggingEmailSender` |
| POST | `/auth/password/reset` | `{ token, newPassword }` | 204 |
| POST | `/auth/email/verify` | `{ token }` | 204 |

Rate limited: login/register/forgot → 429 `RATE_LIMITED`.

## Profile

| GET | `/profile` | → `ProfileDto` |
|---|---|---|
| PUT | `/profile` | `ProfileDto` → `ProfileDto` |
| GET | `/profile/stats` | → `{ tripsTotal, tripsUpcoming, tripsCompleted, destinationsVisited, totalTravelDays, savedPlaces, spending: { currency, amount }[] }` |

## Destinations (public; `saved` populated when a token is sent)

| GET | `/destinations` | query: `q, category, budgetMax (per day), maxDays, featured, sort=featured|name|budget` → `PageResponse<DestinationSummary>` |
|---|---|---|
| GET | `/destinations/categories` | → `CategoryDto[]` |
| GET | `/destinations/{slug}` | → `DestinationDetail` (404 when unpublished) |
| GET | `/destinations/nearby` | `lat, lng, radiusKm (≤1000)` → `(DestinationSummary & { distanceKm: number })[]` |
| GET | `/destinations/{slug}/weather` | → `WeatherDto`; 503 `PROVIDER_UNAVAILABLE` |
| GET | `/attractions/{id}` | → `AttractionDto` |

```ts
type WeatherDto = { provenance: Provenance; timezone: string;
  current: { time: string; temperatureC: number; apparentC: number; precipitationMm: number; windKph: number; weatherCode: number; description: string } | null;
  daily: { date: string; minC: number; maxC: number; precipitationProbability: number | null; precipitationMm: number; weatherCode: number; description: string }[] }
```

## Search

| GET | `/search` | `q` (≥2 chars), `types=destination,attraction` → `{ destinations: DestinationSummary[]; attractions: AttractionDto[] }` |
|---|---|---|
| GET | `/search/suggest` | `q` → `{ type: 'DESTINATION'|'ATTRACTION'|'CATEGORY'; label: string; sublabel: string | null; slug: string; destinationSlug: string | null }[]` (max 8) |
| GET | `/search/popular` | → `string[]` |

## Favorites (auth)

| GET | `/favorites` | → `{ id, targetType: 'DESTINATION'|'ATTRACTION', targetId, createdAt, destination: DestinationSummary|null, attraction: AttractionDto|null }[]` |
|---|---|---|
| POST | `/favorites` | `{ targetType, targetId }` → 201 (idempotent: 200 if exists) |
| DELETE | `/favorites/{targetType}/{targetId}` | → 204 |

## Trips (auth; caller must be a member — Phase 1: owner)

```ts
type TripStatus = 'PLANNING'|'UPCOMING'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'
type TripDto = { id: string; name: string; destination: DestinationSummary | null; destinationName: string;
  startLocation: string | null; startDate: string | null; endDate: string | null; dayCount: number;
  travelers: number; tripType: TravelStyle | null; budgetAmount: string | null; currency: string;
  coverImageUrl: string | null; description: string | null; visibility: 'PRIVATE'|'SHARED_LINK';
  status: TripStatus; archived: boolean; myRole: 'OWNER'|'CO_PLANNER'|'TRAVELER'|'VIEWER';
  itemCount: number; estimatedCost: string; spentAmount: string; version: number; createdAt: string; updatedAt: string }
type TripUpsert = { name; destinationSlug?: string; destinationName: string; startLocation?; startDate?; endDate?;
  dayCount (1–60, derived from dates when both given); travelers (1–50); tripType?; budgetAmount?; currency?;
  coverImageUrl?; description?; visibility?; version? /* required on PUT for optimistic locking */ }
```

| GET | `/trips` | `status, archived=false` → `TripDto[]` (sorted: upcoming first) |
|---|---|---|
| POST | `/trips` | `TripUpsert` → 201 `TripDto` |
| GET | `/trips/{id}` | → `TripDto` |
| PUT | `/trips/{id}` | `TripUpsert` → `TripDto`; 409 `CONFLICT` on stale version |
| DELETE | `/trips/{id}` | → 204 (soft delete) |
| POST | `/trips/{id}/duplicate` | → 201 `TripDto` (copies items, not expenses) |
| POST | `/trips/{id}/status` | `{ status }` → `TripDto` (validated transitions) |
| POST | `/trips/{id}/archive` / `/unarchive` | → `TripDto` |

Status transitions: PLANNING→UPCOMING|CANCELLED, UPCOMING→IN_PROGRESS|PLANNING|CANCELLED,
IN_PROGRESS→COMPLETED|CANCELLED, CANCELLED→PLANNING. `UPCOMING` requires dates.

## Itinerary

```ts
type ItemCategory = 'ATTRACTION'|'RESTAURANT'|'HOTEL'|'ACTIVITY'|'TRANSPORTATION'|'SHOPPING'|'REST'|'EVENT'|'CUSTOM'
type ItemStatus = 'PLANNED'|'BOOKED'|'COMPLETED'|'SKIPPED'|'CANCELLED'
type ItineraryItemDto = { id: string; tripId: string; dayNumber: number; position: number; date: string | null;
  title: string; description: string | null; category: ItemCategory; status: ItemStatus; priority: 'LOW'|'MEDIUM'|'HIGH';
  locationName: string | null; latitude: number | null; longitude: number | null;
  startTime: string | null; endTime: string | null; durationMinutes: number | null;
  estimatedCost: string | null; currency: string; costIsEstimate: boolean;
  notes: string | null; bookingReference: string | null; transportMode: string | null;
  attractionId: string | null; locked: boolean; source: 'USER'|'AI'|'PLANNER'; aiReason: string | null;
  version: number; createdAt: string; updatedAt: string }
type ItineraryWarning = { code: 'OVERLAP'|'TIGHT_TRANSFER'|'LONG_TRANSFER'|'UNREALISTIC_DURATION'|'OUTSIDE_HOURS'|'OVER_BUDGET'|'DAY_OVERLOADED'|'OUT_OF_RANGE_DAY';
  severity: 'INFO'|'WARNING'; message: string; dayNumber: number | null; itemIds: string[] }
type ItineraryDto = { tripId: string; dayCount: number;
  days: { dayNumber: number; date: string | null; items: ItineraryItemDto[]; estimatedCost: string }[];
  warnings: ItineraryWarning[]; estimatedTotal: string; currency: string }
```

| GET | `/trips/{id}/itinerary` | → `ItineraryDto` |
|---|---|---|
| POST | `/trips/{id}/itinerary` | item fields (`dayNumber`, `title`, … ; `position` optional = append) → 201 `ItineraryItemDto` |
| PUT | `/itinerary/{itemId}` | item fields + `version` → `ItineraryItemDto` |
| DELETE | `/itinerary/{itemId}` | → 204 |
| POST | `/itinerary/{itemId}/duplicate` | → 201 `ItineraryItemDto` |
| PUT | `/trips/{id}/itinerary/order` | `{ days: { dayNumber: number; itemIds: string[] }[] }` → `ItineraryDto` (moves + reorders atomically) |

Validations are advisory: they return warnings and never mutate the schedule.
Transfer checks use the route provider when available; otherwise straight-line distance
with an explicitly "approximate" message.

## AI trip planner

```ts
type PlanRequest = { startLocation?: string; destinationSlug?: string; destinationName?: string;
  startDate?: string; flexibleDates?: boolean; days: number (1–14); travelers: number (1–20);
  budget?: string; currency?: string; transport?: 'ROAD_TRIP'|'BUS'|'TRAIN'|'FLIGHT'|'MIXED';
  accommodation?: 'BUDGET'|'MIDRANGE'|'LUXURY'|'HOSTEL'|'HOMESTAY'|'CAMPING';
  styles: TravelStyle[]; interests: string[]; pace: 'RELAXED'|'BALANCED'|'PACKED';
  dietary?: string; accessibility?: string }
type ProposedItem = { dayNumber; position; title; description; category: ItemCategory; attractionId: string | null;
  locationName; latitude; longitude; startTime; endTime; durationMinutes; estimatedCost: string | null; currency;
  reason: string; alternatives: string[]; locked: boolean /* true = carried over from user's locked items */ }
type PlanProposal = { id: string; engine: { id: 'anthropic'|'deterministic'; label: string; model: string | null; simulated: boolean };
  request: PlanRequest; tripId: string | null; summary: string;
  days: { dayNumber: number; date: string | null; title: string; items: ProposedItem[] }[];
  estimatedTotal: string; currency: string; budgetStatus: 'WITHIN'|'OVER'|'UNKNOWN';
  tips: string[]; assumptions: string[]; warnings: string[]; createdAt: string }
```

| GET | `/ai/status` | → `{ engine: 'anthropic'|'deterministic'; label; model; simulated }` |
|---|---|---|
| POST | `/ai/trip-planner/generate` | `PlanRequest` → `PlanProposal` |
| POST | `/ai/trip-planner/modify` | `{ tripId, instruction (≤500 chars) }` → `PlanProposal` (keeps every `locked` item and every item with status BOOKED/COMPLETED) |
| POST | `/ai/trip-planner/proposals/{proposalId}/apply` | `{ tripId?: string; trip?: TripUpsert }` → `TripDto`. With `tripId`: replaces that trip's unlocked, non-booked items. With `trip`: creates a trip. Nothing is written until this call (explicit user confirmation). |

Rate limited per user (10 generate/modify per hour by default).

## Maps

| POST | `/maps/route` | `{ points: {lat,lng}[] (2–25), mode?: 'DRIVING' }` → `{ provenance; distanceKm: number; durationMinutes: number | null; geometry: [number, number][] /* [lat,lng] */; legs: { distanceKm: number; durationMinutes: number | null }[] }` |
|---|---|---|
| POST | `/maps/optimize` | `{ points: {lat,lng}[] (2–25), keepFirst: true, keepLast: false }` → `{ provenance; order: number[]; distanceKmBefore: number; distanceKmAfter: number }` |

## Budget & expenses

```ts
type BudgetCategory = 'TRANSPORTATION'|'ACCOMMODATION'|'FOOD'|'ACTIVITIES'|'SHOPPING'|'FUEL'|'TICKETS'|'RENTALS'|'OTHER'
type BudgetDto = { currency: string; totalBudget: string | null; perPersonBudget: string | null; travelers: number;
  estimatedItineraryCost: string; spent: string; remaining: string | null;
  byCategory: { category: BudgetCategory; budget: string | null; estimated: string; spent: string }[] }
type ExpenseDto = { id; tripId; title; amount: string; currency; category: BudgetCategory; paidByUserId; paidByName;
  date: string; notes: string | null; paymentMethod: string | null; clientRequestId: string | null; createdAt; updatedAt; version }
```

| GET | `/trips/{id}/budget` | → `BudgetDto` |
|---|---|---|
| PUT | `/trips/{id}/budget` | `{ totalBudget: string|null; categoryBudgets: Partial<Record<BudgetCategory,string>> }` → `BudgetDto` |
| GET | `/trips/{id}/expenses` | → `ExpenseDto[]` |
| POST | `/trips/{id}/expenses` | `{ title, amount, currency?, category, date, notes?, paymentMethod?, clientRequestId? }` → 201 (same `clientRequestId` → returns existing, 200) |
| PUT | `/expenses/{id}` | → `ExpenseDto` |
| DELETE | `/expenses/{id}` | → 204 |

Expenses in a currency different from the trip currency are stored as-is and excluded from
totals with a note (no invented FX rates).

## Checklist

```ts
type ChecklistItemDto = { id; label; category: 'CLOTHING'|'DOCUMENTS'|'ELECTRONICS'|'MEDICINES'|'TOILETRIES'|'FOOD'|'SAFETY'|'ADVENTURE'|'ESSENTIALS'|'OTHER';
  completed: boolean; position: number; suggested: boolean; reason: string | null }
type ChecklistDto = { id; tripId; name; templateKey: string | null; items: ChecklistItemDto[]; completedCount: number; totalCount: number }
```

| GET | `/checklist-templates` | → `{ key; name; description; items: { label; category }[] }[]` |
|---|---|---|
| GET | `/trips/{id}/checklists` | → `ChecklistDto[]` |
| POST | `/trips/{id}/checklists` | `{ name, templateKey? }` → 201 `ChecklistDto` |
| POST | `/trips/{id}/checklists/suggest` | → `{ provenance; items: { label; category; reason }[] }` (rule-based on destination categories, forecast, duration, trip type; nothing saved) |
| DELETE | `/checklists/{id}` | → 204 |
| POST | `/checklists/{id}/items` | `{ label, category, suggested?, reason? }` → 201 `ChecklistItemDto` |
| PUT | `/checklist-items/{id}` | `{ label?, category?, completed? }` → `ChecklistItemDto` |
| DELETE | `/checklist-items/{id}` | → 204 |

## Admin (permission-guarded on the server)

| GET | `/admin/stats` | `admin:access` → `{ totalUsers, activeUsers30d, newUsers7d, totalTrips, upcomingTrips, completedTrips, destinationsPublished, destinationsDraft }` |
|---|---|---|
| GET | `/admin/destinations` | `destination:write`; `q, status, page, size` → `PageResponse<DestinationSummary & { status; updatedAt }>` |
| GET | `/admin/destinations/{id}` | → `DestinationDetail` (any status) |
| POST | `/admin/destinations` | `DestinationUpsert` → 201 `DestinationDetail` (status DRAFT) |
| PUT | `/admin/destinations/{id}` | `DestinationUpsert` → `DestinationDetail` |
| DELETE | `/admin/destinations/{id}` | → 204 (soft) |
| POST | `/admin/destinations/{id}/publish` / `/unpublish` | `destination:publish` → `DestinationDetail` |
| POST | `/admin/destinations/{id}/attractions` | `AttractionUpsert` → 201 `AttractionDto` |
| PUT/DELETE | `/admin/attractions/{id}` | |
| GET | `/admin/users` | `user:read`; `q, status, page` → `PageResponse<UserDto & { tripCount: number; lastLoginAt: string|null }>` |
| POST | `/admin/users/{id}/suspend` / `/reactivate` | `user:manage`; `{ reason }` → `UserDto` (cannot target self or a SUPER_ADMIN unless caller is SUPER_ADMIN) |
| GET | `/admin/audit-logs` | `audit:read`; `page` → `PageResponse<{ id; actorEmail; action; targetType; targetId; details; createdAt }>` |

`DestinationUpsert` = editable fields of `DestinationDetail` minus derived ones, plus
`categorySlugs: string[]`, `featured`, `seoTitle`, `seoDescription`, `gallery`.
`AttractionUpsert` = editable fields of `AttractionDto`.
