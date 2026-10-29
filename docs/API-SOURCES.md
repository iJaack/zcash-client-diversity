# API sources and measurement limits

Verified on **29 October 2026, 18:11–18:12 UTC** using public HTTPS GET requests. These observations are evidence of the API's behavior at that time, not a service guarantee.

## Primary source: ZecBlock

ZecBlock, formerly CipherScan, provides the current public census. See its [API reference](https://zecblock.com/docs) and [OpenAPI contract](https://zecblock.com/openapi-v1.json).

| Data | Endpoint | Fields used |
| --- | --- | --- |
| Current census | [`/v1/network/nodes/stats`](https://api.zecblock.com/v1/network/nodes/stats) | `data.stats`, `data.clients`, `data.trends` |
| Client history | [`/v1/network/nodes/history?period=30d`](https://api.zecblock.com/v1/network/nodes/history?period=30d) | `data.snapshots[].time`, `activeNodes`, `identifiedClientNodes`, `clientCounts` |
| Full active version list | [`/v1/network/nodes/list?limit=500`](https://api.zecblock.com/v1/network/nodes/list?limit=500) | `data.total`, `data.nodes[].client`, `version`, `protocolVersion` |
| Protocol adoption | [`/v1/network/nodes/upgrade-readiness`](https://api.zecblock.com/v1/network/nodes/upgrade-readiness) | `data.versions`, `totalActive`, `latestProtocol` |

Public reads succeeded without credentials or an API key. Requests with an arbitrary browser `Origin` returned HTTP 403 and `Origin is not allowed.` Fetch from the dashboard's backend using ordinary server requests without an `Origin` header. Do not send a forged allowed origin. The observed rate policy was **600 requests per 60 seconds**; honor rate-limit headers and `Retry-After` rather than treating that limit as permanent.

The v1 response envelope is `{ data, meta }`. Errors use `application/problem+json`; check HTTP status before interpreting a response as data. `meta.generatedAt` is response generation time, not census observation time. At verification, `meta.freshness.status` was `unknown`; use `data.stats.lastUpdated` for the census clock. The stats aggregate has an internal cache of about five minutes, even though crawl stats/history responses use `Cache-Control: no-store`.

### Current census fields

`data.stats` includes `activeNodes`, `lastUpdated`, `censusVersion`, `scope`, `crawlerChainProof`, `observationWindowSeconds`, `peerObservationWindowSeconds`, `chainQualifiedCrawlerNodes`, `localPeerNodes`, `localPeerOnlyNodes`, and `overlapNodes`.

`data.clients.distribution` contains `{ client, count }` entries. The denominator for observed-client shares is `data.clients.observedNodes`; `identifiedNodes` and `coveragePercentage` report identification coverage. Preserve `Unknown`, `Other`, and `Seeder` as explicit categories. Unknown software is not an additional identified implementation.

The verified snapshot observed **467 active IPs**: Zebra 317, Zakura 146, Seeder 2, Unknown 2; 465 were identified. zcashd was absent from that distribution. Report this as zero observed zcashd in the source's measured population, rather than a claim of global absence.

`data.clients.versions` contains only the **12 most common client/version pairs**, so it is not a complete version inventory. The pseudonymous active-node list provides the remaining versions and supports `limit`/`offset` pagination, with a maximum page size of 500. Independently queried/cached routes can differ slightly as observations expire: stats returned 467 while the directory returned 466 during verification. Avoid mixing those denominators without disclosure.

### History fields and provenance

Accepted `period` values are `24h`, `7d`, `30d`, and `90d`. Each snapshot supplies `time` (ISO UTC), `activeNodes`, `identifiedClientNodes`, and `clientCounts`, an object mapping client names to integer counts. Missing client categories can represent zero within an otherwise valid complete distribution; missing snapshots or unavailable history do not represent zero nodes.

The 30-day request returned 2,961 samples from **19 October 2026 11:30 UTC to 29 October 18:10 UTC**, approximately five minutes apart. Every sample's client counts summed to its active count. A requested range does not guarantee that much available history. Display the actual observation range and preserve gaps.

Individual history samples do **not** contain `censusVersion`. The verified upstream implementation filters history by `census_version = 3` when the configured source is crawl mode; the current stats explicitly identify census v3 and its combined crawl/peer scope. Treat this as **source-filtered v3 history**, not a per-sample version field. Reject or withhold comparable history if that current source contract cannot be established. See the [pinned history implementation](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/routes/network.js#L29-L35) and [history route](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/api/routes/network.js#L921).

## What the census measures

The [pinned census v3 methodology](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/deploy/COMBINED-NODE-CENSUS.md) describes an IP-deduplicated union of:

- Connections reported by the provider's own consensus node within 900 seconds.
- Crawler responders with a successful handshake and matching Zcash mainnet checkpoint header within 3,600 seconds.

Use **observed active unique IPs**, not global node census, operator count, hashpower, or stake. Ports on one IP collapse together; IPv4 and IPv6 remain separate identities. Local peers have a separate admission rule and are not necessarily independently challenged by the crawler. At verification, 50 crawler-qualified IPs plus 417 local-peer-only IPs made up the 467 total.

The crawler challenge uses mainnet block 3,520,000 and proof marker `zcash-mainnet-checkpoint-v1`. Serving that header does not establish current synchronization, complete block validation, or independent/honest operation. Legacy zcashd halted below that checkpoint and cannot qualify through this crawler rule. The methodology records **Flux contamination discovered on 19 October 2026** and explicitly excludes earlier v2 history from comparable growth baselines.

`totalNodes` is labeled `all-historical-candidate-ips` and includes foreign/discovery records. Never present it as active or verified all-time Zcash nodes. Likewise, unavailable Tor classification is `null`, not a measured zero; topology is currently marked unavailable.

Client names and versions are self-reported. The [upstream parser](https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/lib/peer-client.js) recognizes Zebra, Zakura, zcashd/MagicBean, Seeder, and other labels. Zakura's [official README](https://github.com/zakura-core/zakura) identifies it as a Zebra fork. Distinct advertised clients do not imply fully independent code lineages.

## Sources excluded from the census

[Blockchair's Zcash node endpoint](https://api.blockchair.com/zcash/nodes) returned 978 entries, all advertising MagicBean, all reporting height zero, with 962 on port 16125 and none advertising Zebra or Zakura. This is consistent with foreign-chain contamination; neither those software strings nor ports prove Zcash chain identity. Its stats endpoint repeated the same 978 count. The dashboard does not use these counts as a verified census. The [Zcash DNS-seeder investigation](https://forum.zcashcommunity.com/t/magicbean-6-0-0/42184) also documents Flux peers appearing in Zcash address gossip.

The provider's [`/v1/network/peers`](https://api.zecblock.com/v1/network/peers) is one node's connection inventory, so it is not an independent alternative census. The old CipherScan hosts still served the same underlying v3 aggregates in verification; they are aliases, not corroborating independent sources.

## Research fixtures

`tests/fixtures/zecblock-stats.json` is the captured public aggregate stats response. `tests/fixtures/zecblock-history.json` preserves three selected actual history samples (first, middle, last) in the response envelope. The history fixture is intentionally a compact subset, not a full time series. Neither fixture includes individual node addresses or IPs. Fixtures are for validation and must not be displayed as current live data.
