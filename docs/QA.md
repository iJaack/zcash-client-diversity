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
