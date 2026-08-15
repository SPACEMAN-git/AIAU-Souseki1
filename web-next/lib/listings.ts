// Supabase PostGIS の listings を地図 viewport（bounding box）で引くクライアント。
// RPC は search_listings_in_bounds（0002_search_listings_in_bounds.sql）。

export interface PropertyListing {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  /** 家賃（円/月） */
  monthlyRent: number;
  managementFee: number;
  layout: string | null;
  /** 専有面積（m2） */
  floorArea: number | null;
  nearestStationName: string | null;
  walkMinutes: number | null;
}

export interface ListingBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// RPC は listings 行をそのまま返す（snake_case）
interface ListingRow {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  monthly_rent: number;
  management_fee: number | null;
  layout: string | null;
  floor_area: string | number | null;
  nearest_station_name: string | null;
  walk_minutes_to_station: number | null;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
const RPC_NAME = "search_listings_in_bounds";
const LIMIT = 300;

export function listingsConfigured(): boolean {
  return SUPABASE_URL !== null && ANON_KEY !== null;
}

function toNumber(value: string | number | null): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(row: ListingRow): PropertyListing {
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    lat: row.latitude,
    lng: row.longitude,
    monthlyRent: row.monthly_rent,
    managementFee: row.management_fee ?? 0,
    layout: row.layout,
    floorArea: toNumber(row.floor_area),
    nearestStationName: row.nearest_station_name,
    walkMinutes: row.walk_minutes_to_station,
  };
}

export async function searchListingsInBounds(
  bounds: ListingBounds,
  signal?: AbortSignal,
): Promise<PropertyListing[]> {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error(
      "Supabase の接続先が未設定です。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。",
    );
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${RPC_NAME}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      p_north: bounds.north,
      p_south: bounds.south,
      p_east: bounds.east,
      p_west: bounds.west,
      p_limit: LIMIT,
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`listings の取得に失敗しました（HTTP ${res.status}）`);
  }
  const rows = (await res.json()) as ListingRow[];
  return rows
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude))
    .map(normalize);
}
