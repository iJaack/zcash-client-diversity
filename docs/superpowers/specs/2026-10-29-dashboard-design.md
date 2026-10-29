# Zcash client diversity dashboard

Build a responsive analytical dashboard for observed Zcash mainnet client distribution and historical change. Use the verified public ZecBlock API; never simulate measurements. User requested API research and supplied the public GitHub repository iJaack/zcash-client-diversity.

## Approach
A React + TypeScript + Vite frontend with a small Node 24 server is the selected implementation default. Direct browser requests are blocked by upstream Origin policy; a fixed-endpoint same-origin backend proxy solves this without keys. A static dashboard would lose live refresh; a new crawler would add operational work and is unnecessary given the existing census. No crawler, scheduled task, deployment, or external account provisioning.

## Product
Header with Zcash observatory identity, Overview / Methodology anchors, GitHub link. Title Zcash client diversity. Source status and observation time near the evidence. Hero horizontal distribution, direct client counts/share labels, observed total and identified coverage. Client/version table with client filter and distribution/versions switch. Historical client share SVG plot with 7d/30d selector; preserve gaps and census-version boundaries. CSV export of exactly the displayed aggregate data including source/observation time. Methodology explains sampled unique IPs, self-reported clients, seeders, missing identity, non-equivalence to mining power and independent codebases. No unsupported security rating or threshold.

## Data
GET https://api.zecblock.com/v1/network/nodes/stats and /history?period=7d|30d. Require meta.network mainnet, successful schema validation, nonnegative integer counts, full denominator including Unknown and Seeder. Do not drop novel client names. Source observation is stats.lastUpdated; generatedAt is request generation only. History is separate and may fail while current stats remains usable. Last known good data remain visible on retry failure with explicit status. No data means unavailable, not zero. Versions are explicitly top 12 upstream rows, not a complete version census.

## UI
Warm neutral #fafaf7, near-black text, Zebra forest green, Zakura mustard, zcashd slate blue, neutral unknown/other. Open whitespace and fine rules, no card grid. Image Gen reference and token spec in design/guide.md are the visual baseline; verified measurements replace design dashes and plotted real history replaces the empty concept. React owns UI/state and SVG; plots use 0–100% on y and observation timestamps on x. At most one chart plus one share bar; at most 1500 SVG points per series, source table accessible as alternate. Mobile portrait preserves current state before controls, wraps chart legend and scrolls wide tables. No hover required for essential values; keyboard focus and reduced-motion support.

## Verification
Pure parsing and denominator tests, malformed/missing/wrong-network responses, upstream 429/timeout/partial failure and stale caches, history gaps/version boundary, CSV escaping. Typecheck, production build, browser desktop/mobile including live load, filter, period, versions, export, refresh and unavailable states. Browser plugin absent, so use installed Playwright/Chromium. Compare concept and rendered screenshots and record visual QA.
