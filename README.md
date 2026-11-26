# TravelMate

**Your entire journey. One place.** Discover destinations, draft a realistic day-by-day plan,
see it on a map, keep the budget and packing list beside it — and (in later phases) plan with
friends, book local experiences and keep your memories.

| Path | What it is |
|---|---|
| `travelmate-web/` | Next.js 15 (App Router, TypeScript, Tailwind v4, TanStack Query, Zustand, RHF + Zod, Framer Motion, GSAP, Leaflet) |
| `travelmate-api/` | Spring Boot 3 modular monolith (Java 17, Spring Security + JWT, JPA, Flyway, springdoc) |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) · [API contract](docs/API.md) · [Database](docs/DATABASE.md) · [Design system](docs/DESIGN_SYSTEM.md) · [Progress](docs/PROGRESS.md) |
| `docker-compose.yml` | PostgreSQL 16 + PostGIS, Redis, API container |

## Run it locally (no Docker needed)

Requirements: JDK 17+, Node 20+, pnpm.

```powershell
cd travelmate-api; .\mvnw.cmd spring-boot:run
```

Starts the API on http://localhost:8080 with the `local` profile: an H2 file database in
PostgreSQL mode under `travelmate-api/data/`, migrations and curated seed data applied
automatically, Swagger UI at http://localhost:8080/swagger-ui.html. A development super-admin
is created from the values in `travelmate-api/src/main/resources/application-local.yml`
(dev only, override with `TRAVELMATE_BOOTSTRAP_ADMIN_EMAIL` / `_PASSWORD`).

```powershell
cd travelmate-web; pnpm install; pnpm dev
```

Opens the web app on http://localhost:3000. Browser calls to `/api/v1/*` are proxied to the API
(`API_URL`, default `http://localhost:8080`), so the refresh-token cookie stays first-party.

## Run against PostgreSQL + PostGIS

```powershell
docker compose up -d db redis
```

```powershell
cd travelmate-api; $env:SPRING_PROFILES_ACTIVE='postgres'; .\mvnw.cmd spring-boot:run
```

Copy `.env.example` to `.env` and fill in values first. The `postgres` profile also applies
`db/migration/postgresql` (PostGIS geography columns, GiST and trigram indexes).

## Integrations

| Capability | Default (no keys) | To enable the real thing |
|---|---|---|
| AI planner | Deterministic offline planner over curated places — labelled "Offline planner" in the UI | `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`) |
| Weather | Open-Meteo (keyless, real data) | — |
| Routing | OSRM public demo server, falling back to straight-line distance labelled "approximate" | `OSRM_BASE_URL` for your own router |
| Map tiles | OpenStreetMap standard tiles (keyless; for heavier traffic use your own or a commercial tile provider) | `NEXT_PUBLIC_MAP_TILE_URL` / `_ATTRIBUTION` |
| Email | Logged to the API console (dev only) | SMTP settings (Phase 2) |
| Storage, payments, SMS | Not used in Phase 1 | Phase 2/3 |

Nothing is ever shown as live when it isn't: estimates carry an "Estimate" badge, seed content a
"Curated sample" badge, and integration data its source.

## Quality gates

```powershell
cd travelmate-web; pnpm typecheck; pnpm lint; pnpm test; pnpm build
```

```powershell
cd travelmate-api; .\mvnw.cmd verify
```

End-to-end (API and web both running; uses the installed Microsoft Edge):

```powershell
cd travelmate-web; pnpm e2e
```

Set `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` to include the admin journey.

## Live demo (GitHub Pages)

**https://raiden-56.github.io/travel-mate/**

GitHub Pages only serves static files, so the demo is a static export of `travelmate-web` with an
in-browser implementation of the API (`travelmate-web/src/demo/`). Accounts, trips, expenses and
checklists are saved in the visitor's own browser only; "Reset demo" in the banner clears them.
Weather (Open-Meteo) and driving routes (OSRM demo server) are live; places and prices are the
curated seed data, labelled as such. A demo administrator (credentials shown on the sign-in page)
opens the admin portal. Destinations an admin adds in the demo don't get public pages, because
those are pre-rendered at build time.

`.github/workflows/pages.yml` rebuilds and publishes it on every push to `main`. Build it locally with:

```powershell
cd travelmate-web; $env:NEXT_PUBLIC_DEMO_MODE='1'; $env:NEXT_PUBLIC_BASE_PATH='/travel-mate'; pnpm exec next build
```

Output goes to `travelmate-web/out/`. Demo routes live in `*.demo.tsx` files and server-build
routes in `*.dyn.tsx`; `next.config.ts` picks one set via `pageExtensions`.

## Behind a corporate TLS proxy

If HTTPS is re-signed by a corporate root certificate, Java and Node don't trust it by default:
weather returns 503, routes fall back to straight-line, and Wikimedia images fail through the
Next image optimizer. Tell both runtimes to use the Windows certificate store:

```powershell
java -Djavax.net.ssl.trustStoreType=Windows-ROOT -jar travelmate-api\target\travelmate-api-0.1.0-SNAPSHOT.jar
```

```powershell
$env:NODE_OPTIONS='--use-system-ca'; pnpm --dir travelmate-web dev
```

`.claude/launch.json` already starts both servers this way.

## Deployment

- **Web:** any Next.js host (Vercel, a Node container). Set `API_URL` (server-side) and `NEXT_PUBLIC_SITE_URL`.
- **API:** `travelmate-api/Dockerfile` (multi-stage, non-root). Run with `SPRING_PROFILES_ACTIVE=postgres`,
  a managed PostgreSQL with PostGIS, `JWT_SECRET` (≥ 32 random bytes), and `FRONTEND_URL`. Health: `/actuator/health`.
- Migrations run on startup through Flyway. Back up the database before deploying a new migration;
  roll back by redeploying the previous image (migrations are additive).
