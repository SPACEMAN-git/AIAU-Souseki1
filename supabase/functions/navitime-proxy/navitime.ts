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

// 勤務先から徒歩で行ける「主要起点駅」。通勤可達検索の起点には使わない（起点は常に勤務先座標）。
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

// 駅が属する鉄道路線（transport_node/id?options=detail の details[].link）
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

// 選択された 1 路線の実 GeoJSON（駅座標の直線結びではなく route_transit の shape）
export interface NormalizedRailwayGeometry {
  lineId: string;
  lineName: string;
  operator: string | null;
  color: string | null;
  geometry: { type: "MultiLineString"; coordinates: number[][][] };
  stationIds: string[];
  requestCount: number;
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

interface RawStationDetail {
  company?: RawCompanyItem;
  link?: { id?: string | number; name?: string; color?: string };
}

interface RawStationDetailItem {
  id?: string | number;
  name?: string;
  details?: RawStationDetail[];
}

interface RawLineNode {
  id?: string | number;
  name?: string;
  coord?: RawCoord;
}

interface RawLineItem {
  id?: string | number;
  name?: string;
  type?: string;
  company?: RawCompanyItem;
  nodes?: RawLineNode[];
}

interface RawShapeFeature {
  geometry?: { type?: string; coordinates?: number[][] };
  properties?: { transport_type?: string; ways?: string };
}

interface RawShapeRouteItem {
  sections?: (RawRouteSection & {
    transport?: {
      color?: string;
      links?: { id?: string | number }[];
    };
  })[];
  shapes?: { features?: RawShapeFeature[] };
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

// totalnavi に徒歩専用エンドポイントは無いため、route_transit で全交通機関を除外して
// 徒歩のみの経路を引く（unuse に使える値は API 側で限定されている）。
const WALK_ONLY_UNUSE = [
  "local_train",
  "rapid_train",
  "express_train",
  "sleeper_ultraexpress",
  "superexpress_train",
  "local_bus",
  "highway_bus",
  "shuttle_bus",
  "ferry",
  "domestic_flight",
].join(".");

export async function fetchWalkRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  startTime: string,
  apiKey: string,
): Promise<{ minutes: number; distance: number } | null> {
  const raw = await rapidApiGet(ROUTE_HOST, "/route_transit", {
    start: `${origin.lat},${origin.lng}`,
    goal: `${destination.lat},${destination.lng}`,
    start_time: startTime,
    coord_unit: "degree",
    datum: "wgs84",
    limit: "1",
    unuse: WALK_ONLY_UNUSE,
  }, apiKey) as RawItemsResponse<RawRouteItem>;
  const [first] = normalizeRoute(origin, destination, startTime, raw).routes;
  if (!first) return null;
  return { minutes: first.totalMinutes, distance: first.walkDistance };
}

// 徒歩速度 80m/分 相当で「上限分数なら最大でもこの直線距離」を求め、実経路を引く候補を絞る。
const WALK_METERS_PER_MINUTE = 80;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 直線距離で候補を絞ったうえで、NAVITIME の徒歩経路で実際の所要時間を確認する。
export function nearestStationCandidates(
  origin: { lat: number; lng: number },
  stations: ReachableStation[],
  walkLimit: number,
  candidates: number,
): ReachableStation[] {
  const radius = walkLimit * WALK_METERS_PER_MINUTE;
  return stations
    .filter((s) => haversineMeters(origin, s) <= radius)
    .sort((a, b) => haversineMeters(origin, a) - haversineMeters(origin, b))
    .slice(0, candidates);
}

export function normalizeStationLines(
  raw: RawItemsResponse<RawStationDetailItem>,
): NormalizedStationLines {
  const stations: StationWithLines[] = (raw.items ?? []).map((item) => {
    const lines: StationLine[] = [];
    for (const detail of item.details ?? []) {
      const lineId = detail.link?.id !== undefined
        ? String(detail.link.id)
        : null;
      if (lineId === null || lines.some((l) => l.lineId === lineId)) continue;
      lines.push({
        lineId,
        lineName: detail.link?.name ?? "",
        operator: detail.company?.name ?? null,
        color: detail.link?.color ?? null,
      });
    }
    return {
      stationId: String(item.id ?? ""),
      stationName: item.name ?? "",
      lines,
    };
  });
  return { stations };
}

// 駅（複数可）が属する路線一覧。ID はピリオド区切りで 1 リクエストにまとめられる。
export async function fetchStationLines(
  stationIds: string[],
  apiKey: string,
): Promise<NormalizedStationLines> {
  const raw = await rapidApiGet(TRANSPORT_HOST, "/transport_node/id", {
    id: stationIds.join("."),
    options: "detail",
  }, apiKey) as RawItemsResponse<RawStationDetailItem>;
  return normalizeStationLines(raw);
}

// 経由地は最大 3 点まで等間隔に選び、route が対象路線から外れないようにする。
export function viaIndexes(
  start: number,
  end: number,
  count: number,
): number[] {
  if (end - start <= 1 || count < 1) return [];
  const step = (end - start) / (count + 1);
  const picked = new Set<number>();
  for (let k = 1; k <= count; k += 1) {
    const i = Math.round(start + step * k);
    if (i > start && i < end) picked.add(i);
  }
  return [...picked].sort((a, b) => a - b);
}

// route_transit の shape から「全区間が対象路線」の候補だけを採用する。
// 他路線が混ざった候補を捨てることで、feature を路線に確実に帰属させられる。
function pickLineShapes(
  lineId: string,
  raw: RawItemsResponse<RawShapeRouteItem>,
): { coordinates: number[][][]; color: string | null } | null {
  for (const item of raw.items ?? []) {
    const moves = (item.sections ?? []).filter((s) => s.transport);
    const linkIds = moves.flatMap((s) =>
      (s.transport?.links ?? []).map((l) => String(l.id ?? ""))
    );
    if (linkIds.length === 0 || !linkIds.every((id) => id === lineId)) continue;
    const coordinates = (item.shapes?.features ?? [])
      .filter((f) =>
        f.properties?.transport_type === "railway" &&
        f.geometry?.type === "LineString" &&
        Array.isArray(f.geometry.coordinates)
      )
      .map((f) => f.geometry!.coordinates!);
    if (coordinates.length === 0) continue;
    return {
      coordinates,
      color: moves.find((s) => s.transport?.color)?.transport?.color ?? null,
    };
  }
  return null;
}

async function fetchLineSegmentShapes(
  lineId: string,
  nodes: { id: string; name: string; lat: number; lng: number }[],
  start: number,
  end: number,
  startTime: string,
  apiKey: string,
  depth: number,
  counter: { requests: number },
): Promise<{ coordinates: number[][][]; color: string | null }> {
  const from = nodes[start];
  const to = nodes[end];
  const params: Record<string, string> = {
    start: `${from.lat},${from.lng}`,
    goal: `${to.lat},${to.lng}`,
    start_time: startTime,
    shape: "true",
    limit: "5",
    coord_unit: "degree",
    datum: "wgs84",
  };
  const via = viaIndexes(start, end, depth === 0 ? 3 : 1);
  if (via.length > 0) {
    params.via = JSON.stringify(
      via.map((i) => ({ lat: nodes[i].lat, lon: nodes[i].lng })),
    );
  }
  counter.requests += 1;
  const raw = await rapidApiGet(
    ROUTE_HOST,
    "/route_transit",
    params,
    apiKey,
  ) as RawItemsResponse<RawShapeRouteItem>;
  const picked = pickLineShapes(lineId, raw);
  if (picked) return picked;
  // 他路線経由が最短になる区間は、二分割して路線内だけを通る区間へ落とし込む。
  if (end - start <= 1 || depth >= 3) {
    return { coordinates: [], color: null };
  }
  const mid = Math.floor((start + end) / 2);
  const halves = await Promise.all([
    fetchLineSegmentShapes(
      lineId,
      nodes,
      start,
      mid,
      startTime,
      apiKey,
      depth + 1,
      counter,
    ),
    fetchLineSegmentShapes(
      lineId,
      nodes,
      mid,
      end,
      startTime,
      apiKey,
      depth + 1,
      counter,
    ),
  ]);
  return {
    coordinates: halves.flatMap((h) => h.coordinates),
    color: halves.find((h) => h.color)?.color ?? null,
  };
}

export async function fetchRailwayGeometry(
  lineId: string,
  startTime: string,
  apiKey: string,
): Promise<NormalizedRailwayGeometry> {
  const counter = { requests: 1 };
  const rawLine = await rapidApiGet(TRANSPORT_HOST, "/transport_link/id", {
    id: lineId,
    options: "node",
  }, apiKey) as RawItemsResponse<RawLineItem>;
  const [line] = rawLine.items ?? [];
  if (!line) throw new Error(`line ${lineId} not found`);
  const nodes = (line.nodes ?? [])
    .filter((n) =>
      typeof n.coord?.lat === "number" && typeof n.coord?.lon === "number"
    )
    .map((n) => ({
      id: String(n.id ?? ""),
      name: n.name ?? "",
      lat: n.coord!.lat!,
      lng: n.coord!.lon!,
    }));
  if (nodes.length < 2) throw new Error(`line ${lineId} has no station list`);

  const shapes = await fetchLineSegmentShapes(
    lineId,
    nodes,
    0,
    nodes.length - 1,
    startTime,
    apiKey,
    0,
    counter,
  );

  return {
    lineId,
    lineName: line.name ?? "",
    operator: line.company?.name ?? null,
    color: shapes.color,
    geometry: { type: "MultiLineString", coordinates: shapes.coordinates },
    stationIds: nodes.map((n) => n.id),
    requestCount: counter.requests,
  };
}

export async function fetchAccessStations(
  origin: { lat: number; lng: number },
  walkLimit: number,
  max: number,
  candidates: number,
  startTime: string,
  apiKey: string,
): Promise<NormalizedAccessStations> {
  // 勤務先周辺の駅一覧は reachable_transit（node_type=station）から取り、直線距離で絞る。
  const reachable = await fetchReachable(origin, walkLimit, null, apiKey);
  const nearby = nearestStationCandidates(
    origin,
    reachable.stations,
    walkLimit,
    candidates,
  );

  const walks = await Promise.all(
    nearby.map((station) =>
      fetchWalkRoute(origin, station, startTime, apiKey)
        .then((walk) => ({ station, walk }))
    ),
  );

  const walked: AccessStation[] = walks
    .filter(({ walk }) => walk !== null && walk.minutes <= walkLimit)
    .map(({ station, walk }) => ({
      id: station.id,
      name: station.name,
      lat: station.lat,
      lng: station.lng,
      walkMinutes: walk!.minutes,
      walkDistance: walk!.distance,
    }));

  return {
    origin,
    walkLimit,
    stations: walked
      .sort((a, b) => a.walkMinutes - b.walkMinutes)
      .slice(0, max),
  };
}
