# TravelMate design system

Warm, editorial, photography-led. The product should feel like a well-made travel magazine
that happens to be a precise planning tool — never like a dashboard template.

Source of truth for tokens: `travelmate-web/src/app/globals.css`.

## Color tokens

| Token | Light | Use |
|---|---|---|
| `canvas` | `#F6F3EB` warm ivory | Page background |
| `surface` | `#FFFFFF` | Cards, sheets, inputs |
| `surface-muted` | `#EFEBE1` | Hover fills, skeletons, quiet panels |
| `ink` | `#282A27` charcoal | Primary text |
| `ink-muted` | `#787B73` | Secondary text, labels |
| `line` | `#E7E4DC` | Borders, dividers |
| `sage` | `#58745B` | Links, focus ring, positive state, map markers |
| `forest` | `#283C32` | Primary buttons, hero bands, active nav |
| `amber` | `#D5A06A` | Highlights, countdowns, "estimate" badges, warnings |
| `terracotta` | `#C78165` | Accent CTA, saved hearts, active tab underline |
| `danger` | `#B4533E` | Destructive actions, errors |

Each has a dark-mode value under `:root[data-theme="dark"]`. Light is the default; the user
toggles dark from the account menu (stored per device). Never use purple/blue gradients or neon.

## Typography

- Headings: **Manrope** (variable), tracking `-0.015em`, semibold.
- Body/UI: **Inter** (variable).
- Both are self-hosted from npm (`@fontsource-variable/*`), so builds and page loads make no third-party font requests.
- Scale in use: 11.5 / 12.5 / 13 / 14 / 15 / 16 / 18 / 20 / 24 / 28 / 32 / 48–72 (destination heroes only).

## Shape, depth, spacing

- Radii: 6 / 10 / 14 / 20 px. Cards use 14 px; pills are full.
- Two shadows only: `--shadow-soft` (resting cards) and `--shadow-lift` (hover, dialogs, menus).
- Prefer whitespace and a single shadow over borders. Borders are for inputs, tables and dashed empty states.
- Content width 1280 px (`max-w-7xl`), 16 px gutters on mobile, 24 px from `sm`.

## Components (`src/components`)

| Layer | Contents |
|---|---|
| `ui/` | Button (primary, accent, secondary, ghost, subtle, danger, link), Input/Textarea/Select/Field, Dialog (center + sheet), ConfirmDialog, Dropdown, Badge, Card, Skeleton, Progress, Kbd |
| `common/` | EmptyState, ErrorState (404/403/offline aware), PageHeader, Pagination, TripStatusChip, ItemStatusChip, SourceLabel, SeedBadge, EstimateBadge, EngineBadge, SaveButton |
| `layout/` | SiteHeader (solid/overlay), MobileTabBar, SiteFooter, SearchDialog (Ctrl K), RequireAuth |
| feature folders | destinations, trips, itinerary, maps, budget, ai, admin, landing |

## Honesty labels (required)

| Situation | Component |
|---|---|
| Any cost not entered by the user | `EstimateBadge` or a leading `~` |
| Integration data | `SourceLabel` with `provenance` (source, approximate, simulated) |
| Seed content | `SeedBadge` ("Curated sample") |
| Planner output | `EngineBadge` — amber "Offline planner" when no AI key is configured |

## Motion

- Framer Motion: card hover lift (−3 px), step transitions in the planner, `MotionConfig reducedMotion="user"`.
- GSAP + ScrollTrigger: landing hero parallax and staggered section reveals only.
- CSS keyframes `tm-fade`, `tm-pop`, `tm-slide` for overlays.
- Everything is disabled under `prefers-reduced-motion`.

## Responsive rules

- Mobile: bottom tab bar (Home, Explore, Trips, Plan, Saved) for signed-in users; dialogs become bottom sheets; trip tabs scroll horizontally; filters collapse behind a "Filters" button.
- Tablet: two-column grids; map stacks above the trip sidebar.
- Desktop: itinerary + sticky day map split view; trip map with a side panel; admin sidebar.

## Maps

Leaflet with CARTO Voyager tiles on OpenStreetMap data (configurable via `NEXT_PUBLIC_MAP_TILE_URL`).
Markers are round, white-bordered, colored by category (`CATEGORY_COLORS`), numbered by visit order.
Routes draw in `forest` at 75 % opacity.
