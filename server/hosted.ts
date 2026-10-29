import { createDashboardService } from "./app.ts";

type DashboardService = Pick<
  ReturnType<typeof createDashboardService>,
  "getDashboard"
>;

/** Vercel's Web handler reuses the same fixed-source validation as the local server. */
export function createHostedDashboardHandler(
  service: DashboardService = createDashboardService(),
) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    };
    if (request.method !== "GET") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405, headers: { ...headers, allow: "GET" } },
      );
    }
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "7d";
    if (
      (period !== "7d" && period !== "30d") ||
      url.searchParams.getAll("period").length > 1 ||
      [...url.searchParams.keys()].some((key) => key !== "period")
    ) {
      return Response.json(
        { error: "Use period=7d or period=30d." },
        { status: 400, headers },
      );
    }
    try {
      const payload = await service.getDashboard(period);
      const successful =
        payload.current.data !== null &&
        payload.history.data !== null &&
        !payload.current.error &&
        !payload.history.error;
      return Response.json(payload, {
        headers: {
          ...headers,
          // Public aggregate data can be shared at the CDN; errors are never cached.
          ...(successful
            ? {
                "vercel-cdn-cache-control":
                  "public, s-maxage=60, stale-while-revalidate=120",
              }
            : {}),
        },
      });
    } catch (error) {
      console.error(
        "ZecLens dashboard request failed:",
        error instanceof Error ? error.message : "Unknown failure",
      );
      return Response.json(
        { error: "Unable to load the dashboard." },
        { status: 500, headers },
      );
    }
  };
}
