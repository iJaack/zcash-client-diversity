import {
  aggregateBlockTiming,
  BLOCK_TIMING_SOURCE_URL,
  normalizeTimingPage,
  previousCompleteUtcDay,
} from "../src/lib/blockTiming.ts";
import type {
  BlockTiming,
  TimingBlock,
  TimingPage,
} from "../src/lib/blockTiming.ts";
import type { Resource } from "../src/lib/census.ts";

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface BlockTimingServiceOptions {
  fetch?: Fetch;
  now?: () => number;
  /** Total deadline for every page and response body together. */
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxPages?: number;
}

interface CacheEntry {
  data?: BlockTiming;
  savedAt: number;
  inFlight?: Promise<Resource<BlockTiming>>;
}

class UpstreamHttpError extends Error {
  retryAt: number;
  constructor(status: number, retryAt: number) {
    super(`ZecBlock returned HTTP ${status}.`);
    this.retryAt = retryAt;
  }
}

/** Fixed public GET source; this service creates no jobs or background reads. */
export function createBlockTimingService(
  options: BlockTimingServiceOptions = {},
) {
  const fetchUpstream = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const cacheTtlMs = options.cacheTtlMs ?? 5 * 60_000;
  const maxPages = options.maxPages ?? 50;
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isFinite(cacheTtlMs) ||
    cacheTtlMs < 0 ||
    !Number.isSafeInteger(maxPages) ||
    maxPages < 1
  )
    throw new Error("Invalid block timing service limits.");

  let activeDay = "";
  let entry: CacheEntry = { savedAt: 0 };
  let retryAt = 0;
  let retryError = "";

  function retryDeadline(response: Response): number {
    const header = response.headers.get("retry-after");
    let delay = response.status === 429 ? 60_000 : 0;
    if (header !== null && header.trim() !== "") {
      const seconds = Number(header);
      const date = Date.parse(header);
      if (Number.isFinite(seconds) && seconds >= 0) delay = seconds * 1_000;
      else if (Number.isFinite(date)) delay = Math.max(0, date - now());
    }
    return now() + Math.min(delay, 24 * 60 * 60_000);
  }

  async function capture(day: string): Promise<BlockTiming> {
    const expiresAt = performance.now() + timeoutMs;
    const blocks: TimingBlock[] = [];
    const hashes = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | null = null;
    let total: number | undefined;
    let firstPage: TimingPage | undefined;
    let previousHeight = Infinity;
    const source = new URL(BLOCK_TIMING_SOURCE_URL);
    source.searchParams.set("software", "all");
    source.searchParams.set("from", day);
    source.searchParams.set("to", day);
    source.searchParams.set("limit", "100");

    async function readPage(url: URL): Promise<TimingPage> {
      if (previousCompleteUtcDay(now()) !== day)
        throw new Error(
          "UTC day changed during block capture; refresh to load the latest complete day.",
        );
      const remaining = expiresAt - performance.now();
      if (remaining <= 0)
        throw new Error("ZecBlock block timing capture timed out.");
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const read = async () => {
        const response = await fetchUpstream(url.toString(), {
          signal: controller.signal,
          headers: { accept: "application/json" },
          redirect: "error",
        });
        if (!response.ok)
          throw new UpstreamHttpError(response.status, retryDeadline(response));
        const raw: unknown = await response.json();
        return normalizeTimingPage(raw, day);
      };
      const page = await (async () => {
        try {
          return await Promise.race([
            read(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                reject(new Error("ZecBlock block timing capture timed out."));
                controller.abort();
              }, remaining);
            }),
          ]);
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      })();
      if (performance.now() >= expiresAt)
        throw new Error("ZecBlock block timing capture timed out.");
      return page;
    }

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const url = new URL(source);
      if (cursor !== null) url.searchParams.set("cursor", cursor);
      const page = await readPage(url);
      firstPage ??= page;
      if (total !== undefined && page.total !== total)
        throw new Error(
          "ZecBlock block pagination total changed during capture.",
        );
      total = page.total;
      for (const block of page.blocks) {
        if (hashes.has(block.hash) || block.height >= previousHeight)
          throw new Error(
            "ZecBlock blocks are duplicated or not in descending height order.",
          );
        hashes.add(block.hash);
        previousHeight = block.height;
        blocks.push(block);
      }
      if (blocks.length > total)
        throw new Error(
          "ZecBlock returned more blocks than its pagination total.",
        );
      cursor = page.nextCursor;
      if (cursor === null) {
        if (blocks.length !== total)
          throw new Error(
            "ZecBlock block pagination ended before its total was returned.",
          );
        // Re-read the same first page to detect a changed canonical range during
        // pagination. This is an anchor check, not an immutable source snapshot.
        const anchor = await readPage(source);
        if (
          anchor.total !== total ||
          anchor.blocks.length !== firstPage.blocks.length ||
          anchor.blocks.some(
            (block, index) =>
              block.height !== firstPage!.blocks[index]!.height ||
              block.hash !== firstPage!.blocks[index]!.hash,
          )
        )
          throw new Error(
            "ZecBlock canonical block anchor changed during capture; sample discarded.",
          );
        return aggregateBlockTiming(
          blocks,
          day,
          new Date(now()).toISOString(),
          source.toString(),
        );
      }
      if (cursors.has(cursor))
        throw new Error("ZecBlock block pagination repeated a cursor.");
      cursors.add(cursor);
    }
    throw new Error(
      "ZecBlock block pagination exceeded its page budget; sample discarded.",
    );
  }

  return {
    getTiming(): Promise<Resource<BlockTiming>> {
      const day = previousCompleteUtcDay(now());
      if (day !== activeDay) {
        activeDay = day;
        entry = { savedAt: 0 };
      }
      const current = entry;
      if (now() < retryAt)
        return Promise.resolve({
          data: current.data ?? null,
          error: retryError,
          cached: current.data !== undefined,
        });
      if (current.data !== undefined && now() - current.savedAt < cacheTtlMs)
        return Promise.resolve({
          data: current.data,
          error: null,
          cached: true,
        });
      if (current.inFlight) return current.inFlight;
      current.inFlight = (async () => {
        try {
          const data = await capture(day);
          if (previousCompleteUtcDay(now()) !== day)
            throw new Error(
              "UTC day changed during block capture; refresh to load the latest complete day.",
            );
          // A request begun before UTC midnight never populates the next day's cache.
          current.data = data;
          current.savedAt = now();
          return { data, error: null, cached: false };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "ZecBlock block timing is unavailable.";
          if (error instanceof UpstreamHttpError && error.retryAt > retryAt) {
            retryAt = error.retryAt;
            retryError = message;
          }
          const fallback =
            previousCompleteUtcDay(now()) === day ? current.data : undefined;
          return {
            data: fallback ?? null,
            error: message,
            cached: fallback !== undefined,
          };
        } finally {
          current.inFlight = undefined;
        }
      })();
      return current.inFlight;
    },
  };
}
