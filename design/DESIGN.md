# ZecLens dashboard design

## Current dark cypherpunk system

The current design uses a near-black canvas, sharp panel borders, a faint static grid around the title and mint accents. Sans serif headings and explanatory copy keep the page easy to understand; data, metadata and controls use monospace. Decorative brackets frame the block-timing panel without covering content. No text glow, scanlines or added motion.

| Role | Value |
| --- | --- |
| Canvas / chart | `#090e0c` |
| Panel | `#101914` |
| Hover | `#192a20` |
| Body text | `#e8f0e9` |
| Secondary text | `#a1b3a7` |
| Accent / focus | `#8ef79b` |
| Dividers | `#304638` |
| Control borders | `#658270` |
| Warning text / surface | `#e7bd64` / `#211d12` |
| Zebra | `#65e69a` |
| Zakura | `#e8be56` |
| zcashd | `#8bb8e8` |

Share-bar labels use dark ink on the bright client colors. Chart surfaces and rules share the CSS tokens so the plot integrates with the page. The timing sample and per-client intervals retain equal emphasis, seconds, sample counts and visible qualifications about software-speed comparisons. Controls keep visible keyboard focus; native selects use the dark color scheme. The established layout and mobile stacking remain unchanged.

Body contrast is 16.74:1 against the canvas; secondary text is 8.13:1 on panels. Control borders exceed 3:1 even on hover surfaces. New client categories receive deterministic light colors that remain visible on the dark chart.

The original light concept below records the initial direction. The current palette and geometry above supersede its surface styling.

## Exploration behavior

Client chips, proportional bar segments and chart legend buttons focus the node history and breakdown together. The full sample denominator and original bar widths remain fixed; selection highlights rather than renormalizes the chart. A visible focus summary and Show all clients control explain and clear the selection. Breakdown column buttons sort by client/version name or numeric node count, and export follows the same ordering.

The history inspector uses original observations, including points omitted from sampled lines. Pointer hover, touch taps, a native keyboard slider and Previous/Next/Latest buttons expose timestamp, total, counts and shares. Gaps snap to a labelled recorded sample, never interpolated data. Duplicate timestamps retain separate occurrence identities so keyboard navigation can reach every record; refresh reanchors the selected occurrence where possible. Mobile keeps native horizontal scrolling without drag capture or scroll interception.

Average/Median/P90 switches only the per-tag interval statistic, with a short definition and sample counts; the overview remains the sample average and software-speed caveat stays visible. Share view captures client, date range, grouping, sort and statistic in the URL; Back/Forward restores the same controls. Hover/scrubber selection is temporary. Copy feedback follows the actual clipboard result, ignores stale completions after a view change and offers a selectable link when clipboard access fails. No persistence, background polling or charting dependency is added.

## Historical initial concept

Visual target: `dashboard-concept.png`, a single desktop dashboard around 1440 × 1100. Design goal: let researchers understand the client mix among publicly reachable Zcash nodes, inspect provenance, and explore snapshots without implying a census of the whole network.

## Tokens

| Role | Value |
| --- | --- |
| Canvas | `#fafaf7` |
| Text | `#181b17` |
| Secondary | `#73786e` |
| Rule | `#dedfd7` |
| Zcash brand | `#f4b728` |
| Zebra | `#24764e` |
| Zakura | `#d5a629` |
| zcashd | `#677d9c` |
| Other | `#cdd0c9` |
| Unknown | `#858d91` |

Use a clean sans serif such as Inter with a system fallback. Body 14–16px, supporting lead 18–20px, main title 48–56px / 1.05, section headings 24–28px / 1.15. Headings use 650–750 weight; metadata 12–14px. Numeric columns use tabular figures. Do not reproduce incidental Image Gen text rasterization.

Spacing scale: 4, 8, 12, 16, 24, 32, 40, 56, 64px. Header 80px. Desktop side margins about 60px at 1440px and max content width 1320px. Corners 4–6px on buttons and banner only. Thin dividers, no elevation, minimal surface tint.

## Layout and behavior

The header contains the small yellow Z mark and wordmark on the left, with Overview, Methodology, and GitHub on the right. Overview has a short dark underline.

The page begins with a small uppercase eyebrow, a direct title, and one-line description. Export CSV and Refresh align to the right. Place provenance immediately beneath this region in a quiet full-width banner, with its status and explanation visible together.

Client distribution is the dominant full-width analytical section. Align the Distribution / Versions switch to the section heading. Show reachable-node total and snapshot time in a shared metadata row. Under it, use a 36–44px horizontal 100% track and direct, named color legend. A verified snapshot may replace the neutral empty rail with honest proportional segments; zero totals remain empty, never a synthetic equal distribution.

Below, a 62% / 35% split holds History and Client breakdown with about 3% gap. Both use the canvas surface and a top rule. History has open plotting space with faint rules; the table has compact rows and right-aligned count/share columns. At tablet width these stack; at narrow mobile widths the header wraps or simplifies, controls wrap, chart labels remain readable, and the table retains its essential columns without horizontal page overflow. Use 20px mobile gutters and a 32–36px main title.

Use source-backed refresh status and meaningful disabled/busy button states. Export CSV should download the displayed verified rows and snapshot metadata, or be disabled when no verified data exists. Distribution / Versions must actually change the displayed grouping. Methodology navigation opens or scrolls to the explanation. The GitHub link uses the real repository URL when available. Do not show unimplemented controls as successful interactions.

## Text inventory

- Brand: **Zcash observatory**
- Navigation: **Overview**, **Methodology**, **GitHub ↗**
- Eyebrow: **NETWORK OBSERVATORY**
- Heading: **Zcash client diversity**
- Description: **See which clients power the reachable network.**
- Actions: **Export CSV**, **Refresh**
- Pending banner: **Data source pending**; **No verified snapshot is available yet. Counts and shares will appear after the first successful refresh.**
- Primary section: **Client distribution**; **Share of publicly reachable nodes**
- Switch: **Distribution**, **Versions**
- Metadata: **reachable nodes**; **Last verified snapshot —**
- Client labels: **Zebra**, **Zakura**, **zcashd**, **Other**, **Unknown**
- Pending chart caption: **Waiting for a verified network sample.**
- History: **History**; **Snapshots over time**; **History begins with the first verified snapshot**; **Each refresh adds a point to the client mix over time.**
- Table: **Client breakdown**; **Client**, **Nodes**, **Share**
- Methodology footer: **HOW TO READ THIS**; **Publicly reachable nodes are one view of the network. They do not measure mining share or all full nodes.**; **Read the methodology ↗**

The image deliberately contains no invented numbers, dates, versions, or trend lines. When the researched source is connected, replace pending copy, dashes, and empty chart state only with verified values and explicit observation time. Keep upstream categories and grouping rules traceable; do not silently discard a separate Seeder or other newly observed client category. A single snapshot does not establish history. Local session history should say so if used.

## Five fidelity comparison points

1. **Hierarchy:** at desktop width the page reads from title to provenance, distribution, then history/table. Keep the analytical section dominant and the primary title clearly larger than the section headings.
2. **Surface and color:** the warm canvas is continuous; no card grid or shadow treatment. Green, mustard, blue, and grays identify clients consistently across segments, legend, table, and future history.
3. **Geometry:** use a wide low share bar, aligned left edges, thin rules, compact controls, and a spacious lower two-column region. Keep the footer within the practical desktop composition.
4. **Data honesty:** pending states show dashes and a neutral track. Connected states may deliberately differ from the image by showing real counts and shares, but must retain clear provenance and methodological limits.
5. **Responsive and interaction fidelity:** controls remain recognizable and reachable, labels and numbers remain readable, the lower columns stack cleanly, and every visible control produces its stated result or a clear unavailable state.

## Restrained cypherpunk refinement

The requested refinement keeps the light reading canvas and existing layout. The header now uses forest ink `#14281e`, mint `#8cdbad` hairlines, and high-contrast navigation. Body text stays sans serif; data, controls and metadata use the system monospace stack. Corners and dividers are crisper without glow, noise or decorative motion. Current text is `#18231c`, muted text `#626b61`, and the rule color `#d2dbce`. Client colors retain their existing meanings.

A quiet full-width timing band sits below the node distribution. Its sample average and client-tag table use neutral emphasis, explicit seconds and sample counts; no winner color or fastest-client ranking. Mobile stacks the sample average above a compact three-column table. The data view is observed mining activity, with software-speed qualifications kept visible.
