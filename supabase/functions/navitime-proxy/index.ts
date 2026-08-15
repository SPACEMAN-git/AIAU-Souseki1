// navitime-proxy Edge Function
// GET ?action=geocode&q=<住所>
// GET ?action=reachable&lat=<lat>&lng=<lng>&term=<分, 1-180>
// 共通: &mock=1 で mock レスポンス（RAPIDAPI_KEY 未設定時も自動で mock にフォールバック）
//
// レスポンス（normalized）:
//   { ok: true,  action, mock: boolean, data: NormalizedGeocode | NormalizedReachable }
//   { ok: false, error: { code, message } }

import { fetchGeocode, fetchReachable } from "./navitime.ts";
import { mockGeocode, mockReachable } from "./mock.ts";

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
        const origin = { lat, lng };
        const data = useMock
          ? mockReachable(origin, term)
          : await fetchReachable(origin, term, apiKey!);
        return json({ ok: true, action, mock: useMock, data });
      }
      default:
        return errorResponse(
          "bad_request",
          "action must be one of: geocode, reachable",
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
