# TravelMate — Architecture

> Your entire journey. One place.

This document is the source of truth for how TravelMate is put together. It answers the
twelve questions from the product brief (§48) and is updated as phases land. Module
status lives in [PROGRESS.md](PROGRESS.md); the HTTP contract lives in [API.md](API.md);
tables live in [DATABASE.md](DATABASE.md); visual rules live in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

---

## 1. Product architecture

TravelMate is one product with four surfaces sharing a single backend:

| Surface | Audience | Route prefix (web) | Phase |
|---|---|---|---|
| Public site | Anyone (SEO-indexable destination pages) | `/`, `/explore`, `/destinations/*` | 1 |
| Traveler app | Signed-in travelers | `/home`, `/trips/*`, `/saved`, `/planner`, `/profile` | 1 |
| Admin portal | `ADMIN`, `SUPER_ADMIN` | `/admin/*` | 1 (destinations, users) |
| Provider portal | `PROVIDER` | `/provider/*` | 3 |

The journey the product optimises for: **discover → plan (AI) → edit → save trip →
collaborate → book → budget/checklist/documents → travel (offline) → remember**.
Phase 1 delivers discover → plan → edit → save → budget → checklist end to end.

## 2. Module breakdown

| Module | Responsibility | Phase |
|---|---|---|
| auth | Registration, login, JWT access tokens, rotating refresh tokens, password reset | 1 |
| users / profiles | Account, profile, preferences, traveler stats | 1 |
| rbac | Roles, permissions, method-level enforcement | 1 |
| destinations | Destinations, categories, images, attractions, public read API | 1 |
| search | Unified search + suggestions across destinations and attractions (PostgreSQL first) | 1 |
| favorites | Saved destinations and attractions | 1 |
| trips | Trip CRUD, status lifecycle, duplication, membership (owner only in P1) | 1 |
| itinerary | Items, ordering, moves between days, smart validations | 1 |
| ai | Planner engine abstraction (Claude or deterministic planner), proposals, modify | 1 |
| maps | Route + distance provider abstraction, stop-order optimisation | 1 |
| weather | Weather provider abstraction (Open-Meteo, keyless) | 1 |
| budget / expenses | Trip budget, category budgets, expenses (decimal-safe) | 1 (splitting P2) |
| checklist | Templates, trip checklists, rule-based suggestions | 1 |
| admin | Destination management, user management, KPIs | 1 |
| audit | Append-only audit log of security-relevant and admin actions | 1 |
| collaboration | Invitations, roles, votes, comments, chat | 2 |
| documents | Private object storage, signed URLs | 2 |
| notifications | In-app + email, preferences | 2 |
| offline | Service worker cache + mutation queue + conflict handling | 2 |
| providers / marketplace / bookings / payments | Provider onboarding, listings, booking lifecycle, payments | 3 |
| memories / journal / subscriptions | | 4 |

## 3. System architecture

```
Browser ──► Next.js (travelmate-web, :3000)
              │  • RSC pages for public/SEO routes fetch API server-side (API_URL)
              │  • Client components use TanStack Query against same-origin /api/v1/*
              │  • next.config rewrites /api/v1/* ──► Spring Boot
              ▼
          Spring Boot modular monolith (travelmate-api, :8080)
              │  controller → service → repository, DTOs only at the edge
              │  Spring Security (stateless JWT) + @PreAuthorize permissions
              ├─► PostgreSQL 16 + PostGIS   (prod / docker profile)
              ├─► H2 in PostgreSQL mode      (local profile, zero-dependency dev)
              ├─► Redis                      (Phase 2: rate limit + cache; in-memory impl in P1)
              ├─► S3-compatible storage      (Phase 2: documents, memories)
              └─► Integration ports
                    AiPlannerEngine   → AnthropicPlannerEngine | DeterministicPlannerEngine
                    RouteProvider     → OsrmRouteProvider | StraightLineRouteProvider
                    WeatherProvider   → OpenMeteoWeatherProvider | UnavailableWeatherProvider
                    EmailSender       → LoggingEmailSender (dev, labelled) | SMTP (P2)
```

**Why same-origin proxying:** the refresh token lives in an `HttpOnly; SameSite=Strict`
cookie scoped to `/api/v1/auth`. Proxying through Next keeps it first-party, so no
cross-site cookies and no CORS for the browser path.

**Why a modular monolith:** one deployable, one transaction boundary, package-per-module
with no cross-module repository access (modules talk through services). Splitting later
is a packaging exercise, not a rewrite. No microservices until a module has a scaling
or ownership reason to leave.

### Integration honesty rules

Every integration port returns its `source` and whether the data is `approximate` or
`simulated`. The UI shows that label. Concretely:

- **Routes:** OSRM when reachable; otherwise straight-line (haversine) distance with
  `durationMinutes: null` and the label "straight-line distance". We never invent a drive time.
- **Weather:** Open-Meteo forecast (real, keyless). If it fails the API returns 503 and the
  UI shows "Weather unavailable" — never a placeholder forecast.
- **AI:** with `ANTHROPIC_API_KEY` set, Claude plans via structured tool output validated
  against our schema and our attraction catalogue. Without a key, the deterministic planner
  builds itineraries from curated seed attractions with proximity ordering; responses carry
  `engine.simulated = true` and the UI says "Offline planner — no AI key configured".
- **Prices:** every cost is `costIsEstimate: true` unless entered by the user or (P3) confirmed
  by a provider. Seed costs are ranges labelled "estimate".
- **Opening hours:** stored only as `openingHoursNote`; validations about hours run only when
  `openingHoursVerified = true`.

## 4. Database schema

See [DATABASE.md](DATABASE.md). Highlights: UUID primary keys, `created_at/updated_at` on every
table, soft deletion (`deleted_at`) for user-owned content (trips, items, expenses),
`NUMERIC(12,2)` for money with an ISO-4217 `currency` column, latitude/longitude as
`NUMERIC(9,6)` in portable migrations plus a PostgreSQL-only migration that adds PostGIS
`geography(Point)` generated columns and GiST indexes.

Flyway locations: `db/migration/common` (portable SQL, runs everywhere) and
`db/migration/postgresql` (PostGIS, trigram search indexes; Postgres profile only).

## 5. Role and permission structure

Roles are bundles of permissions; code checks **permissions**, never role names.

| Permission | TRAVELER | PROVIDER | ADMIN | SUPER_ADMIN |
|---|:-:|:-:|:-:|:-:|
| `trip:own` (create/manage own trips) | ✓ | ✓ | ✓ | ✓ |
| `admin:access` | | | ✓ | ✓ |
| `destination:write` | | | ✓ | ✓ |
| `destination:publish` | | | ✓ | ✓ |
| `user:read` | | | ✓ | ✓ |
| `user:manage` (suspend/reactivate) | | | ✓ | ✓ |
| `audit:read` | | | ✓ | ✓ |
| `role:manage` | | | | ✓ |
| `provider:self` (P3) | | ✓ | | |

Resource-level checks happen in services: trip access goes through
`TripAccessService.require(tripId, userId, TripPermission)` which resolves the caller's trip
role (`OWNER`, `CO_PLANNER`, `TRAVELER`, `VIEWER`; only `OWNER` is created in Phase 1).
Admins do **not** get implicit access to private trips.

## 6. Frontend structure

```
travelmate-web/src/
  app/
    (public)/            landing, explore, destinations/[slug] (RSC, SEO metadata, JSON-LD)
    (auth)/              login, register, forgot-password, reset-password
    (traveler)/          home, trips, trips/[id]/{overview,itinerary,map,budget,checklist}, saved, planner, profile
    admin/               destinations, destinations/[id], users, audit
    sitemap.ts, robots.ts
  components/ui/         primitives (button, input, dialog, sheet, tabs, badge, skeleton, …)
  components/layout/     app shell, sidebar, mobile bottom nav, trip workspace nav
  components/common/     EmptyState, ErrorState, PageHeader, StatusChip, SourceLabel
  components/{destinations,trips,itinerary,maps,…}
  features/<module>/     api.ts (typed client calls), hooks.ts (TanStack Query), schemas.ts (Zod)
  lib/                   api client, auth store, formatting (money, dates), query client
  types/                 API DTO types mirrored from API.md
```

Rules: pages compose feature hooks + components; components never call `fetch` directly;
forms use React Hook Form + Zod schemas that mirror backend Bean Validation.

## 7. Backend structure

```
travelmate-api/src/main/java/com/travelmate/
  common/      ApiError/ProblemDetail handler, PageResponse, money, time, security utils
  config/      SecurityConfig, OpenApiConfig, properties
  auth/        controller, service, jwt, refresh tokens, password reset
  users/       User, Role, Permission, profile, stats
  destinations/ attractions + categories + public read
  search/      unified search
  favorites/
  trips/       Trip, TripMember, TripAccessService
  itinerary/   ItineraryItem, validation engine
  ai/          AiPlannerEngine port, Anthropic + deterministic engines, proposals
  maps/        RouteProvider port, OSRM + straight-line, optimiser
  weather/     WeatherProvider port, Open-Meteo
  budget/      budget + expenses
  checklist/   templates + trip checklists + suggester
  admin/       admin controllers (delegate to module services)
  audit/
```

Each module: `*Controller` (HTTP only) → `*Service` (transactions, rules) → `*Repository`
(Spring Data) with `dto/` records and `*Mapper`. Entities never leave the service layer.

## 8. API structure

REST under `/api/v1`, JSON, ISO-8601 dates, UUID ids, `PageResponse` for lists
(`items, page, size, totalItems, totalPages`), RFC 7807 `ProblemDetail` errors with a stable
`code` and optional `errors[]` field list. Full contract: [API.md](API.md). Swagger UI at
`/swagger-ui.html`, spec at `/v3/api-docs`.

## 9. UI design system

Warm, editorial, photography-led. Ivory canvas, forest/sage structure, amber and terracotta
accents, Manrope headings, Inter body. Details and tokens: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 10. Implementation roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| 1 Core | auth, profile, dashboard, discovery, destination detail, search, trips, AI planner, itinerary editor, map, budget + expenses, checklist, favorites, admin destinations/users | E2E: register → discover → save → generate plan → edit → map → budget → checklist → admin creates destination |
| 2 Collaboration | invitations, trip roles, voting, comments, chat, expense splitting + settlements, documents vault, notifications, offline | Two users plan one trip, split expenses, work offline and sync without silent overwrite |
| 3 Marketplace | providers, onboarding, verification, listings, availability, booking lifecycle, payments (provider port), commission, payouts, reviews | Provider approved → listing → booking request → provider confirms → traveler sees confirmed |
| 4 Ecosystem | assistant with tool calling across modules, integrations (hotels/flights/rail), journal + memories, subscriptions, mobile | |

## 11. Development risks

| Risk | Mitigation |
|---|---|
| AI produces plausible but wrong places/costs/hours | Constrain the model to catalogue attractions via tool schema; validate every item server-side; label estimates; reject unknown ids |
| External APIs need keys or have usage limits | Port/adapter per integration, keyless defaults where they exist (Open-Meteo, OSRM demo), honest fallbacks |
| Money rounding | `BigDecimal`/`NUMERIC(12,2)` end to end; frontend formats strings, never adds floats |
| Scope (the brief is a multi-year product) | Phase gates; definition of done per module; PROGRESS.md is updated every phase |
| Offline sync conflicts (P2) | `version` column on mutable rows (optimistic locking) from Phase 1; client mutation ids for idempotency |
| PostGIS not available in local dev | Portable lat/lng columns + Postgres-only migration; haversine fallback in queries |
| Seed data mistaken for live data | `is_seed_data` flag; UI shows "Curated sample" badge; seed costs are ranges marked estimate |

## 12. MVP scope (Phase 1, this build)

In: everything in the Phase 1 row above.
Out (explicitly): bookings/payments, provider portal, collaboration, documents, notifications,
offline sync, chat, journal. Navigation entries for these are **not** shown until they work
(no dead buttons).

---

## Configuration & profiles

| Profile | DB | Use |
|---|---|---|
| `local` (default) | H2 file DB in PostgreSQL mode | Run with only a JDK + Node |
| `postgres` | PostgreSQL + PostGIS via `docker compose up db` | Production-like |
| `test` | H2 in-memory | Unit/integration tests |

All secrets come from environment variables (see `.env.example`). The dev bootstrap admin
is created only when `TRAVELMATE_BOOTSTRAP_ADMIN_EMAIL` and `_PASSWORD` are set.
