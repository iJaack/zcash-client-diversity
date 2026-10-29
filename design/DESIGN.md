# Zcash observatory dashboard concept

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
