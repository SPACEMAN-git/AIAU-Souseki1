// navitime-proxy Edge Function クライアント（normalized レスポンスの型と呼び出し）

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export interface ReachableStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timeMinutes: number;
  transfers: number;
}

// 勤務先から実徒歩で行ける「主要起点駅」。通勤可達検索の起点は常に勤務先座標のままで、この駅では絞り込まない。
export interface AccessStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  walkMinutes: number;
  walkDistance: number;
}

export interface NormalizedAccessStations {
  origin: { lat: number; lng: number };
  walkLimit: number;
  stations: AccessStation[];
}

export interface NormalizedGeocode {
  query: string;
  // 住所検索で 0 件のとき Edge Function が駅名検索にフォールバックする
  source: "address" | "transport_node";
  results: GeocodeResult[];
}

export interface NormalizedReachable {
  origin: { lat: number; lng: number };
  term: number;
  transitLimit: number | null;
  stations: ReachableStation[];
}

// 主要起点駅が属する鉄道路線（路線選択 UI 用）
export interface StationLine {
  lineId: string;
  lineName: string;
  operator: string | null;
  color: string | null;
}

export interface StationWithLines {
  stationId: string;
  stationName: string;
  lines: StationLine[];
}

export interface NormalizedStationLines {
  stations: StationWithLines[];
}

// 選択された 1 路線の実 GeoJSON（NAVITIME route_transit の shape）
export interface NormalizedRailwayGeometry {
  lineId: string;
  lineName: string;
  operator: string | null;
  color: string | null;
  geometry: { type: "MultiLineString"; coordinates: number[][][] };
  stationIds: string[];
  requestCount: number;
}

interface ProxyOk<T> {
  ok: true;
  action: string;
  mock: boolean;
  data: T;
}

interface ProxyErr {
  ok: false;
  error: { code: string; message: string };
}

type ProxyResponse<T> = ProxyOk<T> | ProxyErr;

export interface ProxyResult<T> {
  data: T;
  mock: boolean;
}

const PROXY_URL = process.env.NEXT_PUBLIC_NAVITIME_PROXY_URL ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/navitime-proxy`
    : null);

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const USE_MOCK = process.env.NEXT_PUBLIC_NAVITIME_MOCK === "1";

export function proxyConfigured(): boolean {
  return PROXY_URL !== null;
}

async function callProxy<T>(
  params: Record<string, string>,
): Promise<ProxyResult<T>> {
  if (!PROXY_URL) {
    throw new Error(
      "navitime-proxy の URL が未設定です。NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_NAVITIME_PROXY_URL を設定してください。",
    );
  }
  const url = new URL(PROXY_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (USE_MOCK) url.searchParams.set("mock", "1");

  const headers: Record<string, string> = {};
  if (ANON_KEY) {
    headers["Authorization"] = `Bearer ${ANON_KEY}`;
    headers["apikey"] = ANON_KEY;
  }

  const res = await fetch(url.toString(), { headers });
  const body = (await res.json().catch(() => null)) as
    | ProxyResponse<T>
    | null;
  if (!body) {
    throw new Error(`API 呼び出しに失敗しました（HTTP ${res.status}）`);
  }
  if (!body.ok) {
    throw new Error(`${body.error.code}: ${body.error.message}`);
  }
  return { data: body.data, mock: body.mock };
}

export function geocode(query: string): Promise<ProxyResult<NormalizedGeocode>> {
  return callProxy<NormalizedGeocode>({ action: "geocode", q: query });
}

export function reachable(
  origin: { lat: number; lng: number },
  term: number,
  transitLimit: number | null,
): Promise<ProxyResult<NormalizedReachable>> {
  const params: Record<string, string> = {
    action: "reachable",
    lat: String(origin.lat),
    lng: String(origin.lng),
    term: String(term),
  };
  if (transitLimit !== null) params.transit_limit = String(transitLimit);
  return callProxy<NormalizedReachable>(params);
}

export function accessStations(
  origin: { lat: number; lng: number },
  walkLimit = 15,
  max = 3,
): Promise<ProxyResult<NormalizedAccessStations>> {
  return callProxy<NormalizedAccessStations>({
    action: "access_stations",
    lat: String(origin.lat),
    lng: String(origin.lng),
    walk_limit: String(walkLimit),
    max: String(max),
  });
}

export function stationLines(
  stationIds: string[],
): Promise<ProxyResult<NormalizedStationLines>> {
  return callProxy<NormalizedStationLines>({
    action: "station_lines",
    ids: stationIds.join(","),
  });
}

export function railwayGeometry(
  lineId: string,
): Promise<ProxyResult<NormalizedRailwayGeometry>> {
  return callProxy<NormalizedRailwayGeometry>({
    action: "railway_geometry",
    line_id: lineId,
  });
}
