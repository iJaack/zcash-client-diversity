import { ArrowUpRight } from "lucide-react";
import type { Census } from "../lib/census.ts";
const source =
  "https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/deploy/COMBINED-NODE-CENSUS.md";
export default function Methodology({ census }: { census: Census | null }) {
  return (
    <section
      id="methodology"
      className="methodology"
      aria-labelledby="methodology-title"
    >
      <div className="methodology-intro">
        <span className="eyebrow">HOW TO READ THIS</span>
        <h2 id="methodology-title">One view of the network.</h2>
        <p>
          Observed IPs reveal the software this source sees. They do not measure
          mining power, independent operators, or every Zcash full node.
        </p>
        <a href={source} target="_blank" rel="noreferrer">
          Source methodology <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="methodology-notes">
        <div>
          <h3>A combined observation</h3>
          <p>
            ZecBlock combines local peers seen within{" "}
            {census?.peerWindowSeconds
              ? Math.round(census.peerWindowSeconds / 60)
              : 15}{" "}
            minutes and crawler responders seen within{" "}
            {census?.crawlerWindowSeconds
              ? Math.round(census.crawlerWindowSeconds / 60)
              : 60}{" "}
            minutes, deduplicated by IP. Ports on one IP collapse; IPv4 and IPv6
            remain separate.
          </p>
          {census && (
            <p className="sample-counts">
              {census.localPeerNodes ?? "—"} local peers +{" "}
              {census.crawlerNodes ?? "—"} crawler IPs −{" "}
              {census.overlapNodes ?? "—"} overlap = {census.total} observed
              IPs.
            </p>
          )}
        </div>
        <div>
          <h3>Client names ≠ independent codebases</h3>
          <p>
            Identities and versions are self-reported.{" "}
            <a
              href="https://github.com/zakura-core/zakura"
              target="_blank"
              rel="noreferrer"
            >
              Zakura is a fork of Zebra
            </a>
            , so separate client shares do not establish independent consensus
            implementations. Seeders stay in the denominator.
          </p>
        </div>
        <div>
          <h3>A consistent baseline</h3>
          <p>
            Census v3 filters foreign-chain crawler responses using a Zcash
            checkpoint. Earlier v2 observations are not comparable. The API’s
            compatible history starts on October 19, 2026; requested periods may
            have less coverage.
          </p>
        </div>
        <div>
          <h3>Absence has limits</h3>
          <p>
            <a
              href="https://zcash.github.io/zcash/user/end-of-life.html"
              target="_blank"
              rel="noreferrer"
            >
              zcashd reached end of life
            </a>{" "}
            before the crawler’s checkpoint height. Zero observed zcashd peers
            does not prove none exist. The checkpoint proves a served header,
            not full synchronization or honest validation.
          </p>
        </div>
      </div>
    </section>
  );
}
