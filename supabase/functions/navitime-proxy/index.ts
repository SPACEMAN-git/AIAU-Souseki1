// navitime-proxy Edge Function
// GET ?action=geocode&q=<住所 or 駅名（住所が 0 件なら駅名検索へフォールバック）>
// GET ?action=reverse_geocode&lat=<lat>&lng=<lng>
// GET ?action=reachable&lat=<lat>&lng=<lng>&term=<分, 1-180>[&transit_limit=<乗換回数上限, 0-30>]
// GET ?action=access_stations&lat=<lat>&lng=<lng>[&walk_limit=<徒歩分上限, 1-60, 既定 15>][&max=<最大件数, 1-10, 既定 3>][&candidates=<徒歩経路を引く候補数, 1-10, 既定 5>]
//   → 勤務先から実徒歩 walk_limit 分以内の鉄道駅を徒歩時間昇順で最大 max 件（地図の主要起点駅）
//   ※ 通勤可達範囲の検索（action=reachable）の起点はこの駅でなく常に勤務先実坐標
// GET ?action=reachable_area&lat=<lat>&lng=<lng>&term=<分, 1-180>&mode=<bicycle|walk>[&bicycle_speed=<km/h, 5-50>]
// GET ?action=transport&q=<駅名>[&limit=<1-30>]
// GET ?action=transport_company&id=<会社 ID>
// GET ?action=route&from_lat=&from_lng=&to_lat=&to_lng=[&start_time=<ISO8601>]
// 共通: &mock=1 で mock レスポンス（RAPIDAPI_KEY 未設定時も自動で mock にフォールバック）
//
// レスポンス（normalized）:
//   { ok: true,  action, mock: boolean, data: Normalized(Geocode|ReverseGeocode|Reachable|AccessStations|ReachableArea|Transport|TransportCompany|Route) }
//   { ok: false, error: { code, message } }

import {
  fetchAccessStations,
  fetchGeocode,
  fetchReachable,
  fetchReachableArea,
  fetchReverseGeocode,
  fetchRoute,
  fetchTransportCompany,
  fetchTransportNode,
} from "./navitime.ts";
import {
  mockAccessStations,
  mockGeocode,
  mockReachable,
  mockReachableArea,
  mockReverseGeocode,
  mockRoute,
  mockTransport,
  mockTransportCompany,
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
      case "reverse_geocode": {
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return errorResponse("bad_request", "lat/lng must be numbers", 400);
        }
        const coord = { lat, lng };
        const data = useMock
          ? mockReverseGeocode(coord)
          : await fetchReverseGeocode(coord, apiKey!);
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
      case "access_stations": {
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return errorResponse("bad_request", "lat/lng must be numbers", 400);
        }
        const intParam = (
          name: string,
          fallback: number,
          min: number,
          max: number,
        ): number | Response => {
          const raw = url.searchParams.get(name);
          if (raw === null || raw === "") return fallback;
          const n = Number(raw);
          if (!Number.isInteger(n) || n < min || n > max) {
            return errorResponse(
              "bad_request",
              `${name} must be an integer between ${min} and ${max}`,
              400,
            );
          }
          return n;
        };
        const walkLimit = intParam("walk_limit", 15, 1, 60);
        if (walkLimit instanceof Response) return walkLimit;
        const max = intParam("max", 3, 1, 10);
        if (max instanceof Response) return max;
        const candidates = intParam("candidates", 5, 1, 10);
        if (candidates instanceof Response) return candidates;
        const origin = { lat, lng };
        const data = useMock
          ? mockAccessStations(origin, walkLimit, max)
          : await fetchAccessStations(
            origin,
            walkLimit,
            max,
            candidates,
            defaultStartTime(),
            apiKey!,
          );
        return json({ ok: true, action, mock: useMock, data });
      }
      case "reachable_area": {
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
        const mode = url.searchParams.get("mode") ?? "bicycle";
        if (mode !== "bicycle" && mode !== "walk") {
          return errorResponse(
            "bad_request",
            "mode must be bicycle or walk",
            400,
          );
        }
        const speedRaw = url.searchParams.get("bicycle_speed");
        let bicycleSpeed: number | null = null;
        if (speedRaw !== null && speedRaw !== "") {
          const n = Number(speedRaw);
          if (!Number.isFinite(n) || n < 5 || n > 50) {
            return errorResponse(
              "bad_request",
              "bicycle_speed must be a number between 5 and 50",
              400,
            );
          }
          bicycleSpeed = n;
        } else if (mode === "bicycle") {
          bicycleSpeed = 15;
        }
        const origin = { lat, lng };
        const data = useMock
          ? mockReachableArea(origin, term, mode, bicycleSpeed)
          : await fetchReachableArea(origin, term, mode, bicycleSpeed, apiKey!);
        return json({ ok: true, action, mock: useMock, data });
      }
      case "transport_company": {
        const id = url.searchParams.get("id")?.trim();
        if (!id) return errorResponse("bad_request", "id is required", 400);
        const data = useMock
          ? mockTransportCompany(id)
          : await fetchTransportCompany(id, apiKey!);
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
          "action must be one of: geocode, reverse_geocode, reachable, access_stations, reachable_area, transport, transport_company, route",
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
