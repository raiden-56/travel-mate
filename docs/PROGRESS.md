# TravelMate — development checklist

Legend: ✅ done · 🧪 done and covered by automated tests · 🟡 partial · ⏳ pending · ⛔ blocked

## Phase 0 — Foundations

| Item | Status | Notes |
|---|---|---|
| Architecture, API contract, design system docs | ✅ | `docs/` |
| Next.js app (App Router, TS strict, Tailwind v4) | ✅ | `travelmate-web` |
| Spring Boot modular monolith | ✅ | `travelmate-api` |
| Database schema + Flyway migrations | ✅ | `docs/DATABASE.md` |
| Docker Compose (PostGIS, Redis, API) | ✅ | Daemon not running on the dev machine, so not exercised yet |
| CI pipeline | ⏳ | GitHub Actions workflow to add once a remote exists |

## Phase 1 — Core TravelMate

| Module | Backend | Frontend | Tests | Notes |
|---|---|---|---|---|
| Auth (register, login, refresh rotation, logout, reset, verify) | ✅ | ✅ | 🧪 | Emails logged to console by the dev-only `LoggingEmailSender` |
| Profile + travel stats | ✅ | ✅ | | |
| Home dashboard | — | ✅ | E2E | Personalised from trips, stats, favorites |
| Destination discovery + filters + near me | ✅ | ✅ | E2E | |
| Destination detail (SEO, JSON-LD, sitemap, robots) | ✅ | ✅ | E2E | Hotels, restaurants and reviews come with the Phase 3 marketplace |
| Unified search + suggestions + recent searches | ✅ | ✅ | | Uses PostgreSQL/H2 LIKE; trigram index in the postgres migration |
| Favorites | ✅ | ✅ | E2E | |
| Trips (CRUD, status machine, duplicate, archive, optimistic locking) | ✅ | ✅ | 🧪 | |
| Itinerary editor (drag and drop across days, validations) | ✅ | ✅ | 🧪 | Day board, overview, desktop split map |
| AI planner (generate, modify, apply with confirmation) | ✅ | ✅ | 🧪 | Claude when `ANTHROPIC_API_KEY` is set; labelled offline planner otherwise |
| Interactive map (layers, route, optimise order, add from map) | ✅ | ✅ | | OSRM demo server with straight-line fallback |
| Weather (Open-Meteo) | ✅ | ✅ | | Keyless, real forecast |
| Budget + expenses (decimal-safe, idempotent create) | ✅ | ✅ | 🧪 | Splitting arrives in Phase 2 |
| Checklist (templates, suggestions) | ✅ | ✅ | E2E | |
| Admin: dashboard, destinations, places, users, audit log | ✅ | ✅ | 🧪 | Server-side permission checks |
| Responsive layouts + dark mode | — | ✅ | | Bottom tab bar on mobile |

## Phase 2 — Collaboration ⏳
Invitations, trip roles beyond owner, voting, comments, chat, expense splitting and settlements,
document vault (S3), notifications, offline sync. The schema has `trip_members` and `version`
columns already, so these build on what's there.

## Phase 3 — Marketplace ⏳
## Phase 4 — Ecosystem ⏳

## Verification (latest run)

- Web: typecheck, lint, 31 unit tests, production build — all pass.
- API: `mvnw verify` — 36 tests pass.
- E2E (Playwright, Edge, against H2 local profile): 10/10 pass — register, discover + save, AI plan → trip,
  add activity, expense, checklist, sign out, admin creates a destination, public SEO page on mobile.

## GitHub Pages demo

| Item | Status | Notes |
|---|---|---|
| Static export with in-browser backend (`src/demo`) | 🧪 | 7 unit tests + 4-step Playwright journey (`E2E_DEMO=1`) |
| Deploy workflow (`.github/workflows/pages.yml`) | ✅ | Publishes `out/` to `gh-pages` on push to `main` |

## Known limitations

- **Not yet exercised:** the `postgres` profile and PostGIS migration (Docker daemon was off), and the Claude
  planner path (no `ANTHROPIC_API_KEY` available). The offline planner path is tested.
- The API logs Spring's unused "generated security password" at startup; exclude `UserDetailsServiceAutoConfiguration` to silence it.
- Wikimedia rate-limits bursts of image requests (HTTP 429), so some photos may briefly fail to load in dev. Mirror seed images to your own storage for production.

- Marker clustering isn't enabled yet (current datasets are small); add `leaflet.markercluster` when listings arrive.
- Rate limiting is in-memory (single instance). Swap in Redis before running more than one API instance.
- OSRM's public demo server is for development only; set `OSRM_BASE_URL` to a self-hosted or commercial router for production.
- Seed coordinates are approximate and flagged `is_seed_data`; verify before production use.
- Landing page and sitemap are cached for 5 min / 1 h. If the API is down at build time they render without destinations until the next revalidation.
