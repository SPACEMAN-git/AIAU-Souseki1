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
