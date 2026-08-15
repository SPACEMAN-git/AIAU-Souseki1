// NAVITIME (RapidAPI) クライアント & レスポンス正規化
// RAPIDAPI_KEY は環境変数からのみ取得する（ハードコード禁止）。

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

export interface NormalizedGeocode {
  query: string;
  // address: 住所検索でヒット / transport_node: 駅名検索へフォールバック
  source: "address" | "transport_node";
  results: GeocodeResult[];
}

export interface NormalizedReverseGeocode {
  coord: { lat: number; lng: number };
  results: GeocodeResult[];
}

export interface NormalizedReachable {
  origin: { lat: number; lng: number };
  term: number;
  transitLimit: number | null;
  stations: ReachableStation[];
}

export type ReachableAreaMode = "bicycle" | "walk";

// 自転車 / 徒歩の reachable は駅ではなく到達圏の境界点列を返す。
export interface NormalizedReachableArea {
  origin: { lat: number; lng: number };
  term: number;
  mode: ReachableAreaMode;
  bicycleSpeed: number | null;
  boundary: { lat: number; lng: number }[];
}

export interface TransportCompany {
  id: string;
  name: string;
}

export interface NormalizedTransportCompany {
  id: string;
  company: TransportCompany | null;
}

export interface TransportNode {
  id: string;
  name: string;
  ruby: string;
  types: string[];
  address: string;
  lat: number;
  lng: number;
}

export interface NormalizedTransport {
  query: string;
  nodes: TransportNode[];
}

export interface RouteSection {
  type: "point" | "move";
  name: string;
  nodeId: string | null;
  move: string | null;
  lineName: string | null;
  timeMinutes: number | null;
}

export interface RouteCandidate {
  totalMinutes: number;
  transfers: number;
  walkDistance: number;
  fare: number | null;
  fromTime: string | null;
  toTime: string | null;
  moveTypes: string[];
  sections: RouteSection[];
}

export interface NormalizedRoute {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  startTime: string;
  routes: RouteCandidate[];
}

// RapidAPI hosts（環境変数で上書き可能）
export const GEOCODING_HOST = Deno.env.get("NAVITIME_GEOCODING_HOST") ??
  "navitime-geocoding.p.rapidapi.com";
export const REACHABLE_HOST = Deno.env.get("NAVITIME_REACHABLE_HOST") ??
  "navitime-reachable.p.rapidapi.com";
export const TRANSPORT_HOST = Deno.env.get("NAVITIME_TRANSPORT_HOST") ??
  "navitime-transport.p.rapidapi.com";
export const ROUTE_HOST = Deno.env.get("NAVITIME_ROUTE_HOST") ??
  "navitime-route-totalnavi.p.rapidapi.com";

interface RawCoord {
  lat?: number;
  lon?: number;
}

interface RawGeocodeItem {
  name?: string;
  coord?: RawCoord;
}

interface RawReachableItem {
  id?: string | number;
  node_id?: string | number;
  name?: string;
  coord?: RawCoord;
  time?: number;
  transit_count?: number;
}

interface RawCompanyItem {
  id?: string | number;
  name?: string;
}

interface RawTransportItem {
  id?: string | number;
  name?: string;
  ruby?: string;
  types?: string[];
  address_name?: string;
  coord?: RawCoord;
}

interface RawRouteSection {
  type?: string;
  name?: string;
  node_id?: string | number;
  move?: string;
  line_name?: string;
  time?: number;
}

interface RawRouteItem {
  summary?: {
    move?: {
      time?: number;
      transit_count?: number;
      walk_distance?: number;
      from_time?: string;
      to_time?: string;
      move_type?: string[];
      fare?: Record<string, number | undefined>;
    };
  };
  sections?: RawRouteSection[];
}

interface RawItemsResponse<T> {
  items?: T[];
}

function geocodeResults(
  raw: RawItemsResponse<RawGeocodeItem>,
): GeocodeResult[] {
  return (raw.items ?? [])
    .filter((it) =>
      typeof it.coord?.lat === "number" && typeof it.coord?.lon === "number"
    )
    .map((it) => ({
      name: it.name ?? "",
      lat: it.coord!.lat!,
      lng: it.coord!.lon!,
    }));
}

export function normalizeGeocode(
  query: string,
  raw: RawItemsResponse<RawGeocodeItem>,
): NormalizedGeocode {
  return { query, source: "address", results: geocodeResults(raw) };
}

export function normalizeReverseGeocode(
  coord: { lat: number; lng: number },
  raw: RawItemsResponse<RawGeocodeItem>,
): NormalizedReverseGeocode {
  return { coord, results: geocodeResults(raw) };
}

// 駅名などの検索結果を geocode の結果形式に変換する（住所検索が 0 件のときの補完）。
export function geocodeFromTransport(
  transport: NormalizedTransport,
): NormalizedGeocode {
  return {
    query: transport.query,
    source: "transport_node",
    results: transport.nodes.map((n) => ({
      name: n.address !== "" ? `${n.name}（${n.address}）` : n.name,
      lat: n.lat,
      lng: n.lng,
    })),
  };
}

export function normalizeReachable(
  origin: { lat: number; lng: number },
  term: number,
  transitLimit: number | null,
  raw: RawItemsResponse<RawReachableItem>,
): NormalizedReachable {
  const stations: ReachableStation[] = (raw.items ?? [])
    .filter((it) =>
      typeof it.coord?.lat === "number" && typeof it.coord?.lon === "number"
    )
    .map((it) => ({
      id: String(it.node_id ?? it.id ?? ""),
      name: it.name ?? "",
      lat: it.coord!.lat!,
      lng: it.coord!.lon!,
      timeMinutes: typeof it.time === "number" ? it.time : term,
      transfers: typeof it.transit_count === "number" ? it.transit_count : 0,
    }))
    .sort((a, b) => a.timeMinutes - b.timeMinutes);
  return { origin, term, transitLimit, stations };
}

export function normalizeReachableArea(
  origin: { lat: number; lng: number },
  term: number,
  mode: ReachableAreaMode,
  bicycleSpeed: number | null,
  raw: RawItemsResponse<RawGeocodeItem>,
): NormalizedReachableArea {
  const boundary = (raw.items ?? [])
    .filter((it) =>
      typeof it.coord?.lat === "number" && typeof it.coord?.lon === "number"
    )
    .map((it) => ({ lat: it.coord!.lat!, lng: it.coord!.lon! }));
  return { origin, term, mode, bicycleSpeed, boundary };
}

export function normalizeTransportCompany(
  id: string,
  raw: RawItemsResponse<RawCompanyItem>,
): NormalizedTransportCompany {
  const [first] = raw.items ?? [];
  return {
    id,
    company: first
      ? { id: String(first.id ?? id), name: first.name ?? "" }
      : null,
  };
}

export function normalizeTransport(
  query: string,
  raw: RawItemsResponse<RawTransportItem>,
): NormalizedTransport {
  const nodes: TransportNode[] = (raw.items ?? [])
    .filter((it) =>
      typeof it.coord?.lat === "number" && typeof it.coord?.lon === "number"
    )
    .map((it) => ({
      id: String(it.id ?? ""),
      name: it.name ?? "",
      ruby: it.ruby ?? "",
      types: it.types ?? [],
      address: it.address_name ?? "",
      lat: it.coord!.lat!,
      lng: it.coord!.lon!,
    }));
  return { query, nodes };
}

// NAVITIME の運賃は unit_0（きっぷ）/ unit_48（IC）等の複数体系で返るため、
// IC 運賃を優先し、無ければきっぷ運賃を採用する。
function pickFare(
  fare: Record<string, number | undefined> | undefined,
): number | null {
  if (!fare) return null;
  const ic = fare["unit_48"];
  if (typeof ic === "number") return ic;
  const ticket = fare["unit_0"];
  return typeof ticket === "number" ? ticket : null;
}

export function normalizeRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  startTime: string,
  raw: RawItemsResponse<RawRouteItem>,
): NormalizedRoute {
  const routes: RouteCandidate[] = (raw.items ?? [])
    .filter((it) => typeof it.summary?.move?.time === "number")
    .map((it) => {
      const move = it.summary!.move!;
      return {
        totalMinutes: move.time!,
        transfers: typeof move.transit_count === "number"
          ? move.transit_count
          : 0,
        walkDistance: typeof move.walk_distance === "number"
          ? move.walk_distance
          : 0,
        fare: pickFare(move.fare),
        fromTime: move.from_time ?? null,
        toTime: move.to_time ?? null,
        moveTypes: move.move_type ?? [],
        sections: (it.sections ?? []).map((s) => ({
          type: s.type === "move" ? "move" as const : "point" as const,
          name: s.name ?? "",
          nodeId: s.node_id !== undefined ? String(s.node_id) : null,
          move: s.move ?? null,
          lineName: s.line_name ?? null,
          timeMinutes: typeof s.time === "number" ? s.time : null,
        })),
      };
    })
    .sort((a, b) => a.totalMinutes - b.totalMinutes);
  return { origin, destination, startTime, routes };
}

async function rapidApiGet(
  host: string,
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<unknown> {
  const url = new URL(`https://${host}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": host,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `RapidAPI ${host}${path} ${res.status}: ${body.slice(0, 300)}`,
    );
  }
  return res.json();
}

export async function fetchGeocode(
  query: string,
  apiKey: string,
): Promise<NormalizedGeocode> {
  const raw = await rapidApiGet(GEOCODING_HOST, "/address", {
    word: query,
    limit: "5",
  }, apiKey) as RawItemsResponse<RawGeocodeItem>;
  const geocoded = normalizeGeocode(query, raw);
  if (geocoded.results.length > 0) return geocoded;
  // /address は住所しか引けないため、「東京駅」のような駅名は駅検索でフォールバックする。
  return geocodeFromTransport(await fetchTransportNode(query, apiKey, 5));
}

export async function fetchReverseGeocode(
  coord: { lat: number; lng: number },
  apiKey: string,
): Promise<NormalizedReverseGeocode> {
  const raw = await rapidApiGet(
    GEOCODING_HOST,
    "/address/reverse_geocoding",
    {
      coord: `${coord.lat},${coord.lng}`,
      coord_unit: "degree",
      datum: "wgs84",
    },
    apiKey,
  ) as RawItemsResponse<RawGeocodeItem>;
  return normalizeReverseGeocode(coord, raw);
}

export async function fetchReachable(
  origin: { lat: number; lng: number },
  term: number,
  transitLimit: number | null,
  apiKey: string,
): Promise<NormalizedReachable> {
  const params: Record<string, string> = {
    start: `${origin.lat},${origin.lng}`,
    term: String(term),
    limit: "200",
    // 電車駅に絞る（バス停は除外）
    node_type: "station",
  };
  if (transitLimit !== null) params.transit_limit = String(transitLimit);
  const raw = await rapidApiGet(
    REACHABLE_HOST,
    "/reachable_transit",
    params,
    apiKey,
  ) as RawItemsResponse<RawReachableItem>;
  return normalizeReachable(origin, term, transitLimit, raw);
}

export async function fetchReachableArea(
  origin: { lat: number; lng: number },
  term: number,
  mode: ReachableAreaMode,
  bicycleSpeed: number | null,
  apiKey: string,
): Promise<NormalizedReachableArea> {
  const params: Record<string, string> = {
    start: `${origin.lat},${origin.lng}`,
    term: String(term),
    coord_unit: "degree",
    datum: "wgs84",
  };
  if (mode === "bicycle" && bicycleSpeed !== null) {
    params.bicycle_speed = String(bicycleSpeed);
  }
  const raw = await rapidApiGet(
    REACHABLE_HOST,
    mode === "bicycle" ? "/reachable_bicycle" : "/reachable_walk",
    params,
    apiKey,
  ) as RawItemsResponse<RawGeocodeItem>;
  return normalizeReachableArea(origin, term, mode, bicycleSpeed, raw);
}

export async function fetchTransportCompany(
  id: string,
  apiKey: string,
): Promise<NormalizedTransportCompany> {
  const raw = await rapidApiGet(TRANSPORT_HOST, "/transport_company/id", {
    id,
  }, apiKey) as RawItemsResponse<RawCompanyItem>;
  return normalizeTransportCompany(id, raw);
}

export async function fetchTransportNode(
  query: string,
  apiKey: string,
  limit = 10,
): Promise<NormalizedTransport> {
  const raw = await rapidApiGet(TRANSPORT_HOST, "/transport_node", {
    word: query,
    limit: String(limit),
  }, apiKey) as RawItemsResponse<RawTransportItem>;
  return normalizeTransport(query, raw);
}

export async function fetchRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  startTime: string,
  apiKey: string,
): Promise<NormalizedRoute> {
  const raw = await rapidApiGet(ROUTE_HOST, "/route_transit", {
    start: `${origin.lat},${origin.lng}`,
    goal: `${destination.lat},${destination.lng}`,
    start_time: startTime,
  }, apiKey) as RawItemsResponse<RawRouteItem>;
  return normalizeRoute(origin, destination, startTime, raw);
}
