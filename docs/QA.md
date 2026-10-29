# Verification — 29 October 2026

## Result

Production build and TypeScript check pass. All **29 named tests** pass with `npm test`. Production dependencies: `npm audit --omit=dev` reports zero vulnerabilities. Source content was reviewed for secrets and private context before publication.

Playwright with installed Chromium was used because no Browser/IAB control tool was available in this session. The browser loaded real API data through the backend at both the Vite development entry point and built production server. No framework overlay, blank screen, or JavaScript page error appeared.

## Browser checks

- Desktop 1440×1100 and mobile 390×844.
- Current source status, observation time, counts and shares rendered from live ZecBlock responses.
- Distribution/Versions switch and Zakura filter changed the table.
- Filtered current CSV contained only the selected grouping/client, with source and observation metadata.
- Seven-day and thirty-day requests changed historical coverage; full-history CSV exported every observation rather than sampled plot points.
- Refresh failure retained the last good current observation and showed the failure.
- First-load source outage showed unavailable values and disabled current export.
- Advancing the browser clock sixteen minutes changed the status to delayed without a network request.
- Explicit methodology invalidation removed previously displayed comparable history while retaining a warned current observation.
- Mobile document width equals viewport width; only the wide chart scrolls horizontally. Methodology anchor works.

## Visual fidelity ledger

Reference: `design/dashboard-concept.png`; implementation inspected using `view_image` on desktop/mobile screenshots alongside the reference. Desktop viewport approximately matches the generated concept's native dimensions (1435×1096 concept, 1440×1100 browser).

| Comparison | Reference and implementation | Result |
| --- | --- | --- |
| Hierarchy | Header, large title, provenance, full-width share bar, then history/table | Preserved |
| Canvas/palette | Continuous #fafaf7 canvas, dark text, forest Zebra, mustard Zakura, neutral rules | Preserved |
| Typography | Strong title, restrained section headings, deliberate smaller controls and tabular values | Preserved; system sans fallback |
| Geometry | 60px desktop gutters, 80px header, compact controls, broad share bar, two open columns | Preserved |
| Branding/icons | Square yellow Z mark, restrained outline action icons, no decorative imagery | Square mark corrected during QA |
| Mobile | 20px gutters, wrapped controls, stacked analytics, readable chart labels with native scroll | Verified, no page overflow |
| Data and copy | Concept's dashes/pending chart replaced by verified measurements and history | Intentional data-driven change |

Above-the-fold copy review: brand, title, navigation and action labels preserved. The description and denominator labels intentionally say *observed IPs* instead of claiming a complete reachable-network census. Connected/error/delayed source copy replaces the pending concept. Seeder and novel client categories follow actual source data. Methodology expands below the main dashboard to explain v3 history, shared lineage and measurement limits. No simulated measurements or invented security scores.

The implemented visual system was faithfully verified against the reference with those documented functional/data extensions. No unresolved material visual mismatch remains. The full-history export is available inside the observations disclosure.

## Limits

This is a local application and repository delivery, not a deployed website. ZecBlock is one observation source. Client labels are self-reported and are not proof of independent codebases, operators, honest validation, or mining share. Public upstream access and rate policy can change; errors and last-good states remain explicit.

## ZecLens publishing update

The public product name is now **ZecLens**; “Zcash client diversity” remains the page title and analytical purpose. Added a Vercel Web handler that reuses the tested service, keeps query destinations fixed, and only shares successful public aggregates through a bounded CDN cache. All **32 named tests** and the production build pass, including three hosted-handler boundary/cache checks. Runtime caches are best effort per function instance and do not persist across cold starts. Public deployment verification is recorded after release.

The first Vercel runtime check caught `.ts` import paths surviving compilation into JavaScript. A new compiled-entrypoint regression reproduces the missing-module failure without TypeScript source files, then verifies the emitted route loads and enforces query validation. Enabling TypeScript’s relative import-extension rewrite resolves the reproduced failure. All **33 tests** and the production build pass.


## Custom domain verification

Connected **zeclens.dev** and its www redirect after GoDaddy DNS changes. Vercel reports both names correctly configured with no DNS conflicts. HTTPS certificate covers both names and has automatic renewal enabled. Anonymous HTTPS checks returned 200 for the apex and the live API, and www returned 308 to https://zeclens.dev/. Browser checks on the custom domain verified live data, both history ranges, client/version filtering, CSV download and mobile layout without page errors. The managed browser proxy CA is not trusted directly by Chromium, so production browser resource reads used Node’s TLS-verified fetch through the inherited proxy; TLS verification was kept enabled.

## Cypherpunk refinement and block timing

All **75 tests** and the production build pass. Added complete cursor traversal, canonical anchor revalidation, signed/missing interval handling, fixed-source/query boundaries, capture deadlines, rate-limit backoff, stale states and UTC-midnight cache checks. The compiled-entrypoint check covers both API routes.

Playwright/Chromium checked desktop 1440×1200 and mobile 390×844 / 320×760. The new interval values match the live aggregated API response; zero matching zcashd tags show unavailable timing rather than zero seconds. Median/p90 disclosure, existing version/client filtering, refresh failure and recovery, and first-load timing unavailability all passed without page errors. No horizontal document overflow appeared; the timing table fits the mobile viewport. Header, focus and body contrast were checked; the light canvas and body typography remain readable.

The visible sample average and partial-coverage language describe indexed header observations. Software tags are self-reported and timing is not a controlled client-processing benchmark. No fastest-client claim is made.

## Dark cypherpunk theme

The stronger theme uses near-black surfaces, mint accents, sharp controls and a static title grid. The chart now shares the CSS surface/rule tokens, and client colors are brighter for dark backgrounds. Native controls declare a dark color scheme. Timing values and all data semantics are unchanged.

The production build and all **75 tests** pass. Playwright/Chromium verified desktop 1440×1200 and mobile 390×844 / 320×844 using live API data. Page identity, meaningful content, no framework overlay, no console/page errors, matching dark chart surface, timing disclosure, version/client filtering, CSV export, history range controls and visible keyboard focus all passed. Both the document and timing table fit the narrowest viewport without horizontal overflow. An independent review checked first-load source failures, readable amber warnings, empty states and disabled export at 320px.

Body/canvas contrast is 16.74:1; secondary text/panel is 8.13:1; control borders exceed 3:1 on hover. Every generated category hue retains at least 4.78:1 contrast for its share-bar labels. No dependencies or decorative animations were added. Browser control tools are unavailable in this session, so the installed Playwright/Chromium workflow was used. Public HTTPS browser checks use the existing TLS-verified Node fetch bridge through the managed proxy, as documented above.
