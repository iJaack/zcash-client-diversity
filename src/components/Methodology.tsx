import { ArrowUpRight } from "lucide-react";
import type { Census } from "../lib/census.ts";
const source =
  "https://github.com/Kenbak/zecblock/blob/68bc0676db14214c533c4317bf5e3f36257c13c6/server/deploy/COMBINED-NODE-CENSUS.md";
const audit =
  "https://github.com/iJaack/zcash-client-diversity/blob/main/docs/METHODOLOGY-AUDIT.md";
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
          ZecBlock is the single observation source. Its observed IP mix is a
          sample shaped by discovery and peering, with no guarantee that it
          represents every Zcash full node or independent operator. IP shares do
          not measure mining power.
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
            remain separate. Local peers can enter this sample without the
            crawler’s checkpoint challenge.
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
          <h3>Separate snapshots, shared methodology</h3>
          <p>
            History uses the source’s census v3 filter; earlier v2 observations
            are not comparable. The chart shows actual returned coverage.
            Current counts and history are captured separately, so nearby
            timestamps can have different counts.
          </p>
          <p className="sample-counts">
            <a href={audit} target="_blank" rel="noreferrer">
              Read the dated data audit <ArrowUpRight size={12} />
            </a>
            . It records the checks and their limits.
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
