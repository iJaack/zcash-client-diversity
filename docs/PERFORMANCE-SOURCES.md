# Block timing and client performance: verified sources

Verified using public HTTPS GET requests on **29 October 2026, 20:05–20:10 UTC**. No authentication, API key, provider activation, crawler or job was used. This research does not change the dashboard.

ZecBlock supplies observed block-header intervals and self-reported mining software tags. The inspected endpoints do **not** supply controlled, comparable per-client template-generation, block-validation or proof-of-work solving benchmarks. A tagged block's interval is not a measurement of how quickly its client computes work: the interval reflects network mining, hashpower, difficulty, luck and miner-selected header timestamps. Distinct coinbase tags also do not authenticate the software used.

## Verified public routes

| Route | Verified response fields | Meaning and limits |
| --- | --- | --- |
| [`/v1/mining/software`](https://api.zecblock.com/v1/mining/software) | `data.classifierVersion`, `period`, `bucket`, `from`, `to`, `totalBlocks`, `categories[]`, `history[]`, `coverage`, `notes` | Block counts and block-weighted shares by coinbase marker. Default: 30 UTC calendar days including the unfinished current day. No interval or processing-time statistics. |
| [`/v1/blocks?software=zebra&from=2026-10-28&to=2026-10-28&limit=100`](https://api.zecblock.com/v1/blocks?software=zebra&from=2026-10-28&to=2026-10-28&limit=100) | `data[]`: `height`, `hash`, `timestamp`, `software`, `intervalSeconds`; `meta.page` | Canonical block rows filtered by marker and inclusive UTC header-date range. `intervalSeconds = block.timestamp - canonicalParent.timestamp`, in seconds. Parent lookup uses the unfiltered chain, not the preceding block carrying the same tag. |
| [`/v1/network/block-speed`](https://api.zecblock.com/v1/network/block-speed) | `data.source`, `observedAt`, `nodeHeight`, `indexedHeight`, `tipTimestamp`, `schedule`, `activation`, `coverage`, `days[]`, `windows.latest`, `windows.beforeUpgrade` | Network-wide daily mean, median and p90 header intervals, plus a trailing seven-day summary; 30-day bounded history. No query parameters or client filter. `?software=zebra` returned HTTP 400. |
| [`/v1/network/block-time?period=24h`](https://api.zecblock.com/v1/network/block-time?period=24h) | `data.points[]`: `height`, `timestamp`, `intervalSeconds`, `averageSeconds`, `targetSeconds`, `intervals`; `rollingIntervals`, `downsampleEvery`, `truncated` | Network-wide signed adjacent-header intervals and rolling 120-interval means. Period accepts `6h`, `24h`, `7d`. Response is downsampled to about 800 points and exposes truncation. Do not reconstruct a complete block sample from it. |
| [`/v1/mining/metrics`](https://api.zecblock.com/v1/mining/metrics) | `data.window`, `solrateMethod`, `latest`, `points[]` with `blockTime`, `difficulty`, `solrate`, `txFees`, `txCount` | Network-wide trailing averages, default 20-interval window and 120 displayed points; window 5–100, limit 20–500. `blockTime` is signed mean header interval in seconds, not client runtime. `solrate` estimates work over elapsed header time and supplies no per-client benchmark. |

V1 responses have the envelope `{ data, meta }`. Check HTTP status and response shape before using data. Observed `meta.freshness.status` was `unknown`; `meta.generatedAt` is response-generation time and does not prove source freshness. Block timestamp fields use Unix epoch **seconds**, while `observedAt` and `generatedAt` are ISO UTC. Preserve each clock separately. HTTP caches observed: block-speed 60 seconds, block-time 15 seconds; software history uses an internal cache of about 60 seconds.

## Software identity and range semantics

The six API keys are `zebra`, `zakura`, `other` (labelled **zcashd**), `unknown` (no tag), `conflicting` (multiple tags), and `missing` (coinbase data unavailable). Keep unknown, conflicting and missing blocks in the denominator. Zero tagged zcashd blocks does not establish zero zcashd usage.

Classifier v1 recognizes Zebra's 🦓 and Zakura's 🌸 byte markers, and slash-delimited version strings such as `/Zebra:2.4.0/`, `/Zakura:1.0.0/`, or `/zcashd:6.0.0/`. An observed empty coinbase field is untagged; malformed or unavailable data is missing. Multiple distinct known tags are conflicting.

Software history accepts `period=7d|30d|90d|1y|all|custom|since-zebra|since-zakura` and `bucket=auto|day|week`. `from` and `to` require `period=custom`; both are inclusive UTC dates. Auto uses weekly buckets for ranges longer than 121 days. Weekly buckets start Monday; boundary weeks contain only requested days. Since presets start at the first observed marker, not the client's release date. Empty history buckets have `counts:null`, not measured zero. Coverage bounds describe available indexed history and may extend beyond the selected range.

At 20:06 UTC, the default software response covered **30 September–29 October 2026**, including the partial current day: 34,222 blocks, Zebra 7,690 (22.471%), Zakura 24,236 (70.820%), untagged 2,296 (6.709%); zcashd-tagged, conflicting and missing counts were zero. Its indexed height was 3,535,069. These are historical research observations, not live display fixtures.

## Pagination and a complete bounded observation

For `/v1/blocks`, `from=2026-10-28&to=2026-10-28` means header timestamps in `[2026-10-28T00:00:00Z, 2026-10-29T00:00:00Z)`. Software accepts all six keys plus `all`; order defaults to newest height. The v1 observed default page size is 25; accepted limits are 1–100 (`limit=101` returned HTTP 400 with that constraint). Use an explicit `limit=100` for bounded research. Observed rate headers advertised 600 reads per 60 seconds; honor the actual headers and any `Retry-After`, not a permanent assumed quota.

The exact `meta.page` fields are:

```json
{
  "limit": 2,
  "hasNext": true,
  "hasPrev": false,
  "nextCursor": "<opaque token>",
  "prevCursor": null,
  "total": 114
}
```

This shape and total were observed for the Zebra/date filter with `limit=2`; the cursor placeholder above is explanatory. Follow `nextCursor` as the `cursor` query parameter while retaining every other filter and order. Cursors are opaque and bound to the query. The final page has `hasNext:false`; do not infer completion from one page or a truncated local budget. Validate stable totals, unique hashes, row count, timestamps and order. Explicit `min_height`/`max_height` filters can bound a chosen canonical height range. Pagination across reads is not an immutable chain snapshot; discard/restart on changes rather than attributing a reorg replacement to an earlier hash.

A complete capture of **28 October 2026 UTC** finished at **2026-10-29T20:07:41.658Z**, using `software=all&limit=100` and 12 cursor reads. First-page `meta.generatedAt` was `2026-10-29T20:07:36.002Z`, indexed height 3,535,069. All 1,143 returned canonical heights were contiguous, 3,532,965–3,534,107, with no duplicate hashes, changing totals or unavailable intervals.

| Self-reported winning-block tag | Blocks / timed intervals | Mean parent-header interval | Median | p90 |
| --- | ---: | ---: | ---: | ---: |
| Zebra | 114 / 114 | 80.14 s | 40 s | 191 s |
| Zakura | 962 / 962 | 76.50 s | 55.5 s | 173.9 s |
| No software tag | 67 / 67 | 56.63 s | 22 s | 157.4 s |
| zcashd, conflicting, missing | 0 / 0 | unavailable | unavailable | unavailable |

These summaries group each **current block's interval from its canonical parent** by the current block's marker. They are not elapsed gaps between successive same-client blocks. Median and p90 use linear interpolation (`percentile_cont` semantics). There was one zero-second Zakura interval and no negative intervals; the zero remained in the distribution. Header timestamps can repeat or move backwards, so silently dropping nonpositive values would bias later summaries. Missing intervals must remain unavailable, with timed counts disclosed separately.

If displayed, use a title such as **Observed block intervals by client tag**, a shared UTC range, sample counts and the explicit qualification **Block-header observations; not a software performance benchmark**. Avoid fastest-client rankings, speedup ratios, or a chart labelled time to mine. A processing benchmark needs independently measured same-workload, same-hardware client runtime data, with versions and methodology.

## Network schedule observation

The block-speed response generated at `2026-10-29T20:06:00.496Z` reported source `canonical-block-header-timestamps`, `observedAt=2026-10-29T20:04:22.495Z`, node/indexed height **3,535,069**, and tip header timestamp `1793304249` (**20:04:09 UTC**). Its reported mainnet schedule was 150 seconds from height 0, 75 seconds from 653,600, and 25 seconds from NU7 height **3,543,405**. At that observed height NU7 had **not activated** (`activation:null`); 25 seconds was a future protocol target, not an observed client result or a promised wall-clock activation date.

The latest network-wide trailing seven-day summary contained 8,025 intervals: mean **75.4 s**, median **53 s**, p90 **174 s**, target **75 s**. The 29 October daily bucket was explicitly incomplete. Always use the serving node's returned schedule and current activation state instead of hardcoding this research snapshot.

## Pinned implementation provenance

Inspected revision: [`68bc0676db14214c533c4317bf5e3f36257c13c6`](https://github.com/Kenbak/zecblock/commit/68bc0676db14214c533c4317bf5e3f36257c13c6). Critical classifier, filtered-block and block-speed sources were re-read at this immutable revision and matched the inspected main-branch source.

- [Coinbase marker classifier and category labels](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/lib/mining-software.js#L1).
- [Filter parsing, inclusive UTC dates and exact parent-interval SQL](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/lib/mining-software.js#L56), including [unfiltered parent lookup](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/lib/mining-software.js#L209).
- [Software history periods, aggregation and qualification](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/lib/mining-software.js#L237).
- [Public v1 routes, auth:none and metric descriptions](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/v1/inventory/manifest.js#L73); [software filter schema](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/v1/inventory/parameter-schemas.js#L18).
- [Daily and seven-day network interval calculation](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/lib/block-speed.js#L12).
- [120-interval cadence calculation](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/lib/block-cadence.js#L3) and [network timing routes, caching and downsampling](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/routes/network-readiness.js#L31).
- [Mining metric trailing windows and work estimate](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/routes/network-analytics.js#L189).

This source/API verification establishes available observations and calculation semantics. It does not establish a controlled benchmark or independently authenticate the upstream database and marker claims.
