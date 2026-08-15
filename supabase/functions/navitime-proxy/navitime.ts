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
}

export interface NormalizedGeocode {
  query: string;
  results: GeocodeResult[];
}

export interface NormalizedReachable {
  origin: { lat: number; lng: number };
  term: number;
  stations: ReachableStation[];
}

// RapidAPI hosts（環境変数で上書き可能）
export const GEOCODING_HOST = Deno.env.get("NAVITIME_GEOCODING_HOST") ??
  "navitime-geocoding.p.rapidapi.com";
export const REACHABLE_HOST = Deno.env.get("NAVITIME_REACHABLE_HOST") ??
  "navitime-reachable.p.rapidapi.com";

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
}

interface RawItemsResponse<T> {
  items?: T[];
}

export function normalizeGeocode(
  query: string,
  raw: RawItemsResponse<RawGeocodeItem>,
): NormalizedGeocode {
  const results: GeocodeResult[] = (raw.items ?? [])
    .filter((it) =>
      typeof it.coord?.lat === "number" && typeof it.coord?.lon === "number"
    )
    .map((it) => ({
      name: it.name ?? "",
      lat: it.coord!.lat!,
      lng: it.coord!.lon!,
    }));
  return { query, results };
}

export function normalizeReachable(
  origin: { lat: number; lng: number },
  term: number,
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
    }))
    .sort((a, b) => a.timeMinutes - b.timeMinutes);
  return { origin, term, stations };
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
  return normalizeGeocode(query, raw);
}

export async function fetchReachable(
  origin: { lat: number; lng: number },
  term: number,
  apiKey: string,
): Promise<NormalizedReachable> {
  const raw = await rapidApiGet(REACHABLE_HOST, "/reachable_transit", {
    start: `${origin.lat},${origin.lng}`,
    term: String(term),
    limit: "200",
    // 電車駅に絞る（バス停は除外）。実キーでの結合テスト時に調整する。
    node_type: "station",
  }, apiKey) as RawItemsResponse<RawReachableItem>;
  return normalizeReachable(origin, term, raw);
}
