import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CENSUS_SOURCE_URL,
  normalizeHistory,
  normalizeStats,
} from "../src/lib/census.ts";
import type {
  Census,
  DashboardPayload,
  HistoryPoint,
  Resource,
} from "../src/lib/census.ts";

type Period = "7d" | "30d";
type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
export interface ServiceOptions {
  fetch?: Fetch;
  now?: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
}
interface CacheEntry<T> {
  data?: T;
  savedAt: number;
  inFlight?: Promise<Resource<T>>;
  lastError?: string;
  retryAt?: number;
}

class UpstreamHttpError extends Error {
  retryAt: number;
  constructor(status: number, retryAt: number) {
    super(`ZecBlock returned HTTP ${status}.`);
    this.retryAt = retryAt;
  }
}

export function createDashboardService(options: ServiceOptions = {}) {
  const fetchUpstream = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const cacheTtlMs = options.cacheTtlMs ?? 60_000;
  const current: CacheEntry<Census> = { savedAt: 0 };
  const history: Record<Period, CacheEntry<HistoryPoint[]>> = {
    "7d": { savedAt: 0 },
    "30d": { savedAt: 0 },
  };
  let sourceContractConfirmed = false;
  let sourceEpoch = 0;

  function clearHistory(): void {
    // Detach entries so an older in-flight response cannot repopulate them.
    history["7d"] = { savedAt: 0 };
    history["30d"] = { savedAt: 0 };
  }

  function parseCurrent(raw: unknown): Census {
    try {
      const census = normalizeStats(raw);
      sourceContractConfirmed = true;
      return census;
    } catch (error) {
      sourceContractConfirmed = false;
      sourceEpoch += 1;
      clearHistory();
      throw error;
    }
  }

  function retryDeadline(response: Response): number {
    const retryAfter = response.headers.get("retry-after");
    let delay = response.status === 429 ? 60_000 : 0;
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      const date = Date.parse(retryAfter);
      if (retryAfter.trim() !== "" && Number.isFinite(seconds) && seconds >= 0)
        delay = seconds * 1_000;
      else if (Number.isFinite(date)) delay = Math.max(0, date - now());
    }
    // A malformed upstream header must not suppress reads indefinitely.
    return now() + Math.min(delay, 24 * 60 * 60 * 1_000);
  }

  async function request<T>(
    url: string,
    parse: (raw: unknown) => T,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("ZecBlock request timed out."));
          controller.abort();
        }, timeoutMs);
      });
      const read = async () => {
        const response = await fetchUpstream(url, {
          signal: controller.signal,
          headers: { accept: "application/json" },
          redirect: "error",
        });
        if (!response.ok)
          throw new UpstreamHttpError(response.status, retryDeadline(response));
        const raw: unknown = await response.json();
        return parse(raw);
      };
      return await Promise.race([read(), timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  function resource<T>(
    entry: CacheEntry<T>,
    url: string,
    parse: (raw: unknown) => T,
  ): Promise<Resource<T>> {
    if (
      entry.lastError &&
      entry.retryAt !== undefined &&
      now() < entry.retryAt
    ) {
      return Promise.resolve({
        data: entry.data ?? null,
        error: entry.lastError,
        cached: entry.data !== undefined,
      });
    }
    if (entry.data !== undefined && now() - entry.savedAt < cacheTtlMs)
      return Promise.resolve({ data: entry.data, error: null, cached: true });
    if (entry.inFlight) return entry.inFlight;
    entry.inFlight = (async () => {
      try {
        const data = await request(url, parse);
        entry.data = data;
        entry.savedAt = now();
        entry.lastError = undefined;
        entry.retryAt = undefined;
        return { data, error: null, cached: false };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "ZecBlock data is unavailable.";
        entry.lastError = message;
        entry.retryAt =
          error instanceof UpstreamHttpError ? error.retryAt : undefined;
        return {
          data: entry.data ?? null,
          error: message,
          cached: entry.data !== undefined,
        };
      } finally {
        entry.inFlight = undefined;
      }
    })();
    return entry.inFlight;
  }

  return {
    async getDashboard(period: Period): Promise<DashboardPayload> {
      if (period !== "7d" && period !== "30d")
        throw new Error("Unsupported history period.");
      const currentPromise = resource(current, CENSUS_SOURCE_URL, parseCurrent);
      const historyPromise = resource(
        history[period],
        `https://api.zecblock.com/v1/network/nodes/history?period=${period}`,
        (raw) => {
          const payload = raw as { data?: { period?: unknown } } | null;
          if (payload?.data?.period !== period)
            throw new Error("ZecBlock returned the wrong history period.");
          return normalizeHistory(raw);
        },
      );
      const currentResult = await currentPromise;
      const confirmedForThisRead = sourceContractConfirmed;
      const epochForThisRead = sourceEpoch;
      let historyResult = await historyPromise;
      if (!confirmedForThisRead || epochForThisRead !== sourceEpoch) {
        clearHistory();
        historyResult = {
          data: null,
          error:
            "Comparable history is unavailable: the current mainnet v3 methodology contract could not be confirmed.",
          cached: false,
        };
      }
      return {
        current: currentResult,
        history: historyResult,
        fetchedAt: new Date(now()).toISOString(),
        source: CENSUS_SOURCE_URL,
      };
    },
  };
}

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

function send(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function inside(root: string, file: string): boolean {
  const path = relative(root, file);
  return (
    path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
  );
}

async function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  distDir: string,
): Promise<void> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    send(response, 400, { error: "Invalid path." });
    return;
  }
  if (
    decoded.includes("\0") ||
    decoded.includes("\\") ||
    decoded.split("/").some((segment) => segment.startsWith("."))
  ) {
    send(response, 404, { error: "Not found." });
    return;
  }
  try {
    const root = await realpath(distDir);
    let candidate = resolve(
      root,
      `.${decoded === "/" ? "/index.html" : decoded}`,
    );
    if (!inside(root, candidate)) {
      send(response, 404, { error: "Not found." });
      return;
    }
    try {
      candidate = await realpath(candidate);
    } catch {
      if (extname(decoded)) {
        send(response, 404, { error: "Not found." });
        return;
      }
      candidate = await realpath(resolve(root, "index.html"));
    }
    if (!inside(root, candidate) || !(await stat(candidate)).isFile()) {
      send(response, 404, { error: "Not found." });
      return;
    }
    const data = await readFile(candidate);
    response.writeHead(200, {
      "content-type":
        contentTypes[extname(candidate)] ?? "application/octet-stream",
      "content-length": data.byteLength,
      "cache-control": candidate.endsWith(".html")
        ? "no-cache"
        : "public, max-age=3600",
    });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch {
    send(response, 404, {
      error: "Not found. Run npm run build to create the dashboard.",
    });
  }
}

export interface AppOptions extends ServiceOptions {
  distDir?: string;
}

/** Importing this module opens no port and starts no worker or polling loop. */
export function createAppServer(options: AppOptions = {}): Server {
  const service = createDashboardService(options);
  const distDir =
    options.distDir ?? fileURLToPath(new URL("../dist", import.meta.url));
  return createServer((request, response) => {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    const handle = async () => {
      let url: URL;
      try {
        url = new URL(request.url ?? "/", "http://localhost");
      } catch {
        send(response, 400, { error: "Invalid request URL." });
        return;
      }
      if (url.pathname === "/api/dashboard") {
        if (request.method !== "GET") {
          response.setHeader("allow", "GET");
          send(response, 405, { error: "Method not allowed." });
          return;
        }
        const period = url.searchParams.get("period") ?? "7d";
        if (
          (period !== "7d" && period !== "30d") ||
          url.searchParams.getAll("period").length > 1 ||
          [...url.searchParams.keys()].some((key) => key !== "period")
        ) {
          send(response, 400, { error: "Use period=7d or period=30d." });
          return;
        }
        send(response, 200, await service.getDashboard(period));
        return;
      }
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        send(response, 404, { error: "Not found." });
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("allow", "GET, HEAD");
        send(response, 405, { error: "Method not allowed." });
        return;
      }
      await serveStatic(request, response, url.pathname, distDir);
    };
    handle().catch(() => {
      if (!response.headersSent)
        send(response, 500, { error: "Unable to serve the request." });
      else response.end();
    });
  });
}
