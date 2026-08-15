/**
 * Landmark / building name search via OpenStreetMap Nominatim (free, no key).
 * NAVITIME の住所検索は施設名（東京スカイツリー、渋谷ヒカリエ、大学名など）を
 * 返さないため、候補が少ないときの補完として使う。
 * 利用規約に合わせて UA を送り、呼び出しは候補補完時のみに限定する。
 */

import type { PlaceHit } from "./navitimeSearch.ts";

const HOST = "https://nominatim.openstreetmap.org/search";
const UA = "SUUMAP/1.0 (commute search app; contact via GitHub SPACEMAN-git)";

interface NominatimItem {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
}

/** Returns landmark hits for a free-text query, or [] on any failure. */
export async function osmPlaceSearch(
  query: string,
  limit = 5,
): Promise<PlaceHit[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: String(limit),
    countrycodes: "jp",
    "accept-language": "ja",
  });
  let items: NominatimItem[] = [];
  try {
    const res = await fetch(`${HOST}?${params}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return [];
    items = (await res.json()) as NominatimItem[];
  } catch {
    return [];
  }

  const hits: PlaceHit[] = [];
  for (const it of items) {
    const lat = Number(it.lat);
    const lng = Number(it.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const name = it.name?.trim() || it.display_name?.split(",")[0]?.trim();
    if (!name) continue;
    hits.push({
      name,
      address: japaneseAddress(it.display_name) || name,
      placeType: "address",
      lat,
      lng,
    });
  }
  return hits;
}

/**
 * Nominatim returns "施設名, 番地, 町, 区, 都県, 郵便番号, 日本" (most specific
 * first), so rebuild a Japanese-style address from the administrative parts.
 */
function japaneseAddress(displayName?: string): string {
  if (!displayName) return "";
  const parts = displayName
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && p !== "日本" && !/^\d{3}-?\d{4}$/.test(p));
  return parts.slice(1).reverse().join("") || parts.join("");
}
