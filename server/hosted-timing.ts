import { createBlockTimingService } from "./block-timing.ts";
import { previousCompleteUtcDay } from "../src/lib/blockTiming.ts";

type TimingService = Pick<
  ReturnType<typeof createBlockTimingService>,
  "getTiming"
>;

export function createHostedTimingHandler(
  service: TimingService = createBlockTimingService(),
  now: () => number = Date.now,
) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    };
    if (request.method !== "GET")
      return Response.json(
        { error: "Method not allowed." },
        { status: 405, headers: { ...headers, allow: "GET" } },
      );
    if ([...new URL(request.url).searchParams].length > 0)
      return Response.json(
        { error: "Block timing does not accept query parameters." },
        { status: 400, headers },
      );
    try {
      const payload = await service.getTiming();
      const servedAt = now();
      const midnight = new Date(servedAt);
      midnight.setUTCHours(24, 0, 0, 0);
      // Expire before the selected complete UTC day changes, including at the CDN.
      const cacheSeconds = Math.min(
        300,
        Math.floor((midnight.getTime() - servedAt) / 1_000),
      );
      const cacheable =
        payload.data !== null &&
        payload.error === null &&
        payload.data.day === previousCompleteUtcDay(servedAt) &&
        cacheSeconds > 0;
      return Response.json(payload, {
        headers: {
          ...headers,
          ...(cacheable
            ? { "vercel-cdn-cache-control": `public, s-maxage=${cacheSeconds}` }
            : {}),
        },
      });
    } catch (error) {
      console.error(
        "ZecLens block timing request failed:",
        error instanceof Error ? error.message : "Unknown failure",
      );
      return Response.json(
        { error: "Unable to load block timing." },
        { status: 500, headers },
      );
    }
  };
}
