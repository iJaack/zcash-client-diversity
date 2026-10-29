# Zcash client diversity

A source-backed dashboard for the advertised clients observed on Zcash mainnet. It shows current client shares, compatible historical shares, and the source’s top reported versions, with CSV export and explicit data coverage.

![Dashboard preview](design/dashboard-preview.png)

## Run locally

Requires **Node.js 24 or newer**.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite forwards `/api` to the Node server at `127.0.0.1:3001`.

```sh
npm test
npm run build
npm start
```

The production server serves the built dashboard and its API at `http://127.0.0.1:3001`. Set `HOST` and `PORT` to change the binding. Bind `HOST=0.0.0.0` only when deliberately exposing the service. Node's environment-proxy support preserves configured `HTTP_PROXY` / `HTTPS_PROXY` routing where present.

## Data and methodology

The backend reads ZecBlock’s public mainnet endpoints, without API keys:

- `https://api.zecblock.com/v1/network/nodes/stats`
- `https://api.zecblock.com/v1/network/nodes/history?period=7d` (or `30d`)

Requests go through the same-origin backend because upstream restricts browser origins. Reads happen on page load, period changes, or manual refresh, with a 60-second in-memory cache and bounded timeouts. Concurrent requests for the same resource coalesce. There is no crawler or scheduled polling. A failed request keeps any last successful data visible with an error; an empty server cache produces an unavailable state.

**These are observed active unique IPs, not all nodes, operators, or mining share.** The census combines local peers and chain-qualified crawler responses. Client names are self-reported; Zakura forks Zebra, so advertised client mix is not independent implementation diversity. Seeders and unknown clients remain in the full denominator. The version view contains at most 12 upstream client/version pairs and may not sum to 100%.

Observation time comes from `stats.lastUpdated`, not API response generation time. The UI marks current observations older than 15 minutes as delayed. History uses the source’s v3 route contract and excludes explicit non-v3 points. The source filters v3 in SQL even though its API omits per-point version fields. Missing intervals and incompatible versions are not connected in the plot. Thirty requested days can have fewer available observations.

See [API research and provenance](docs/API-SOURCES.md) for verified endpoints, source implementation links, and excluded sources.

## Project structure

- `src/components/`: distribution table, historical chart, methodology
- `src/lib/`: validated census types/parsers, chart preparation, UI fetch state
- `server/`: fixed-route upstream proxy and static production server
- `tests/`: data integrity, chart gaps, CSV, caching, and server boundaries
- `design/`: visual reference and implementation tokens

No deployment is configured. No analytics, wallet connection, account system, or secret is required.
