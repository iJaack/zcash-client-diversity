# Methodology and data audit

Checked **29 October 2026, approximately 21:37–21:40 America/Cancun** (**30 October 02:37–02:40 UTC**), against ZecLens revision [`23dae9d`](https://github.com/iJaack/zcash-client-diversity/commit/23dae9d317f977191d060c769862054b5b201338).

This audit records a bounded check of specific public responses. The calculations matched the supplied data. Network completeness, authenticated client identities and client processing performance were not established. These results are historical evidence, not continuous monitoring or a guarantee about future responses.

## What was checked

| Check                                             | Result                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete returned block sample for 29 October UTC | All **1,139 blocks** across **12 pages**; unique contiguous heights 3,534,108–3,535,246, stable total and first-page anchor                                                |
| Parent-to-child header intervals                  | All 1,139 matched adjacent header timestamps, including the first block’s parent outside the date window                                                                   |
| Timing aggregation                                | Every category’s count, mean, median and P90 matched a standalone recalculation within floating-point tolerance; both zero-second intervals retained, no missing intervals |
| Independent block samples                         | Hashes and timestamps for heights **3,535,242**, **3,535,246** and **3,535,238** matched Blockchair                                                                        |
| Displayed seven-day history                       | All **2,028** common source records matched the dashboard’s counts and shares                                                                                              |
| Requested thirty-day history                      | All **3,062** returned records had consistent client and identification totals; actual coverage was shorter than thirty days                                               |
| Current census                                    | 467 observed IPs: Zebra 314, Zakura 149, Seeder 2, Unknown 2; counts and identification coverage reconciled                                                                |

The census union also reconciled: **54 crawler-qualified IPs + 449 local peers − 36 overlapping IPs = 467 observed IPs**. Three independent block checks provide limited corroboration; they do not validate the entire chain or authenticate its software tags.

## Freshness and separate clocks

At approximately 21:37 Cancun time, the displayed census observation was about **seven minutes old** and the latest history record about **two minutes old**. Timing covered **29 October UTC**, the latest complete UTC day, from a capture at 21:32:17 Cancun time.

During the check, upstream current stats advanced to 464 IPs while the dashboard still held the earlier 467-IP observation. Source and application caches can cause this lag even after Refresh. A response-generation or fetch timestamp does not establish the age of its underlying observations.

Current statistics and historical records are separate snapshots. The source recomputes current eligibility at query time and exposes the latest underlying peer/proof observation clock; history stores an ingest-time snapshot. Expiring peers and separate cache times can therefore produce different counts near the same timestamp. Their denominators must remain separate.

## Census scope and trust limits

The sample is an IP-deduplicated union of local peers seen within **900 seconds** and crawler responders seen within **3,600 seconds** that served the configured Zcash checkpoint header. In the audited 467-IP sample, **413 IPs (88.4%) were local-peer-only**, without the crawler’s checkpoint challenge.

The checkpoint at height **3,520,000** demonstrates a served header, not complete synchronization or honest validation. Legacy zcashd halted below that checkpoint and cannot qualify through that crawler rule. Zero observed zcashd peers therefore does not prove global absence.

Discovery and peering bias, shared public IPs, invisible peers and separate IPv4/IPv6 identities limit interpretation. The census is not a random sample with a statistical guarantee of network-wide representation. Client names and versions are self-reported. Zakura shares Zebra’s code lineage; distinct labels do not establish independent consensus implementations. Version rows cover only the source’s twelve most common client/version pairs.

The upstream head [`370c6f3`](https://github.com/Kenbak/zecblock/commit/370c6f379c52c7dc940e5a155b055bb4a3ba05a8) had byte-identical census route, helper, client parser and methodology files to the reviewed revision [`68bc067`](https://github.com/Kenbak/zecblock/commit/68bc0676db14214c533c4317bf5e3f36257c13c6). No drift was found in those files.

The source’s crawl-mode history query filters `census_version = 3`. Individual history records omit the version, so ZecLens assigns v3 based on the reviewed source contract and matching current-census schema. The API does not attest its deployed source revision or database contents; its own freshness metadata was `unknown`. Published source and methodology documentation alone cannot prove what is running in production.

## Block intervals and client performance

The timing chart groups each canonical parent-to-child header interval by the ending block’s self-reported coinbase software tag. Mining conditions, difficulty, chance and miner-selected timestamps affect those intervals. A shorter observed interval does not demonstrate faster software.

The dashboard has no controlled client-processing benchmark. Comparing validation, synchronization or template-generation speed requires documented versions, hardware, workloads and test conditions. The observed interval chart must not be used to rank client performance.

## Primary sources

- [ZecBlock current census](https://api.zecblock.com/v1/network/nodes/stats) and [history](https://api.zecblock.com/v1/network/nodes/history?period=30d)
- [Audited block date range](https://api.zecblock.com/v1/blocks?software=all&from=2026-10-29&to=2026-10-29&limit=100); this URL starts pagination rather than returning the whole sample
- [Census methodology](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/deploy/COMBINED-NODE-CENSUS.md)
- [Current-stat clocks and cache](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/routes/network.js#L758) and [history SQL filter](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/routes/network.js#L924)
- [Stored snapshot generation](https://github.com/Kenbak/zecblock/blob/370c6f379c52c7dc940e5a155b055bb4a3ba05a8/server/jobs/ingest-crawl.js#L524)
- Independent Blockchair samples: [3,535,242](https://api.blockchair.com/zcash/dashboards/block/3535242), [3,535,246](https://api.blockchair.com/zcash/dashboards/block/3535246), [3,535,238](https://api.blockchair.com/zcash/dashboards/block/3535238)
- [Official zcashd end-of-life](https://zcash.github.io/zcash/user/end-of-life.html) and [Zakura’s fork description](https://zakura.com/announcements/introducing-zakura/)
