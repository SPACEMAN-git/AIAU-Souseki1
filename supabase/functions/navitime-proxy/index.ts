// navitime-proxy Edge Function
// GET ?action=geocode&q=<住所>
// GET ?action=reachable&lat=<lat>&lng=<lng>&term=<分, 1-180>[&transit_limit=<乗換回数上限, 0-30>]
// GET ?action=transport&q=<駅名>[&limit=<1-30>]
// GET ?action=route&from_lat=&from_lng=&to_lat=&to_lng=[&start_time=<ISO8601>]
// 共通: &mock=1 で mock レスポンス（RAPIDAPI_KEY 未設定時も自動で mock にフォールバック）
//
// レスポンス（normalized）:
//   { ok: true,  action, mock: boolean, data: Normalized(Geocode|Reachable|Transport|Route) }
//   { ok: false, error: { code, message } }

import {
  fetchGeocode,
  fetchReachable,
  fetchRoute,
  fetchTransportNode,
} from "./navitime.ts";
import {
  mockGeocode,
  mockReachable,
  mockRoute,
  mockTransport,
} from "./mock.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return json({ ok: false, error: { code, message } }, status);
}

// NAVITIME は過去時刻の探索を受け付けないため、翌営業日相当の朝 9 時を既定値にする。
function defaultStartTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${
    pad(d.getDate())
  }T09:00:00`;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const apiKey = Deno.env.get("RAPIDAPI_KEY");
  const useMock = url.searchParams.get("mock") === "1" || !apiKey;

  try {
    switch (action) {
      case "geocode": {
        const q = url.searchParams.get("q")?.trim();
        if (!q) return errorResponse("bad_request", "q is required", 400);
        const data = useMock ? mockGeocode(q) : await fetchGeocode(q, apiKey!);
        return json({ ok: true, action, mock: useMock, data });
      }
      case "reachable": {
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        const term = Number(url.searchParams.get("term"));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return errorResponse("bad_request", "lat/lng must be numbers", 400);
        }
        if (!Number.isInteger(term) || term < 1 || term > 180) {
          return errorResponse(
            "bad_request",
            "term must be an integer between 1 and 180",
            400,
          );
        }
        const transitLimitRaw = url.searchParams.get("transit_limit");
        let transitLimit: number | null = null;
        if (transitLimitRaw !== null && transitLimitRaw !== "") {
          const n = Number(transitLimitRaw);
          if (!Number.isInteger(n) || n < 0 || n > 30) {
            return errorResponse(
              "bad_request",
              "transit_limit must be an integer between 0 and 30",
              400,
            );
          }
          transitLimit = n;
        }
        const origin = { lat, lng };
        const data = useMock
          ? mockReachable(origin, term, transitLimit)
          : await fetchReachable(origin, term, transitLimit, apiKey!);
        return json({ ok: true, action, mock: useMock, data });
      }
      case "transport": {
        const q = url.searchParams.get("q")?.trim();
        if (!q) return errorResponse("bad_request", "q is required", 400);
        const limitRaw = url.searchParams.get("limit");
        let limit = 10;
        if (limitRaw !== null && limitRaw !== "") {
          const n = Number(limitRaw);
          if (!Number.isInteger(n) || n < 1 || n > 30) {
            return errorResponse(
              "bad_request",
              "limit must be an integer between 1 and 30",
              400,
            );
          }
          limit = n;
        }
        const data = useMock
          ? mockTransport(q, limit)
          : await fetchTransportNode(q, apiKey!, limit);
        return json({ ok: true, action, mock: useMock, data });
      }
      case "route": {
        const fromLat = Number(url.searchParams.get("from_lat"));
        const fromLng = Number(url.searchParams.get("from_lng"));
        const toLat = Number(url.searchParams.get("to_lat"));
        const toLng = Number(url.searchParams.get("to_lng"));
        if (
          ![fromLat, fromLng, toLat, toLng].every((n) => Number.isFinite(n))
        ) {
          return errorResponse(
            "bad_request",
            "from_lat/from_lng/to_lat/to_lng must be numbers",
            400,
          );
        }
        const startTimeRaw = url.searchParams.get("start_time");
        const startTime = startTimeRaw && startTimeRaw !== ""
          ? startTimeRaw
          : defaultStartTime();
        if (Number.isNaN(Date.parse(startTime))) {
          return errorResponse(
            "bad_request",
            "start_time must be an ISO 8601 datetime",
            400,
          );
        }
        const origin = { lat: fromLat, lng: fromLng };
        const destination = { lat: toLat, lng: toLng };
        const data = useMock
          ? mockRoute(origin, destination, startTime)
          : await fetchRoute(origin, destination, startTime, apiKey!);
        return json({ ok: true, action, mock: useMock, data });
      }
      default:
        return errorResponse(
          "bad_request",
          "action must be one of: geocode, reachable, transport, route",
          400,
        );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return errorResponse("upstream_error", message, 502);
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}
