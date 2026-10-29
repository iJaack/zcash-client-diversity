# Zcash Dashboard Implementation Plan

**Goal:** A usable source-backed client diversity dashboard in iJaack/zcash-client-diversity.
**Architecture:** React/TypeScript UI and fixed-route Node 24 API proxy, on-demand upstream reads with bounded caching. No credentials or jobs.
**Spec:** ../specs/2026-10-29-dashboard-design.md

## Tasks
- [x] Data/server: define shared normalized types, validate current/history payloads, preserve unknowns/denominators, fetch through fixed upstream routes with timeouts/cache and independent partial errors. Add meaningful boundary tests.
- [x] UI: implement Image Gen design through shared tokens; current distribution, historical SVG with time window, filtered version table, CSV export, source/methodology and failure states.
- [x] Verify: run typecheck, tests, production build; verify live backend and desktop/mobile browser core workflows and errors; compare design/render and record QA.
- [x] Delivery: screen staged public contents for secrets/private context, commit, publish using native GitHub connector, independently read back main. Deployment outside scope.

## Review focus
Wrong-network or malformed data must not become zero counts; server must not proxy arbitrary URLs; history must not invent client shares or bridge census boundaries; partial outages preserve available data; export must use the visible observation and safe CSV cells.
