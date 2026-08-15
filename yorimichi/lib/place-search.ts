import "server-only";

import type { PlaceSuggestion } from "./commute-types";
import {
  searchTravelTimeGeocoding,
  type TravelTimeGeocodingFeature,
} from "./commute-provider";

type Coordinates = { lat: number; lng: number };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    osm_value?: string;
    name?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
  };
};

type PhotonResponse = { features?: PhotonFeature[] };

type PoiIntent = {
  pattern: RegExp;
  photonQuery: string;
  category: string;
};

const POI_INTENTS: PoiIntent[] = [
  { pattern: /麦当劳|麥當勞|マクドナルド/i, photonQuery: "マクドナルド", category: "餐饮" },
  { pattern: /药妆店?|藥妝店?|ドラッグストア|薬局/i, photonQuery: "マツモトキヨシ", category: "药妆" },
  { pattern: /星巴克|スターバックス/i, photonQuery: "スターバックス", category: "咖啡" },
  { pattern: /便利店|コンビニ/i, photonQuery: "コンビニ", category: "便利店" },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const TOKYO_POI_RADIUS_KM = 2.5;
const TOKYO_CENTER = { lat: 35.6812, lng: 139.7671 };

function getQueryVariants(query: string) {
  const normalized = query.normalize("NFKC").trim();
  const variants = [normalized];
  if (/六本木.*森(?:ビル|大厦|大樓)|森(?:ビル|大厦|大樓).*六本木/i.test(normalized)) {
    variants.push("六本木ヒルズ森タワー", "Roppongi Hills Mori Tower");
  } else if (/森(?:ビル|大厦|大樓)|Mori Building/i.test(normalized)) {
    variants.push("森タワー", "Mori Building");
  }
  return [...new Set(variants)].slice(0, 3);
}

const cacheHost = globalThis as typeof globalThis & {
  destinationSuggestionCache?: Map<
    string,
    { expiresAt: number; suggestions: PlaceSuggestion[] }
  >;
};
const suggestionCache =
  cacheHost.destinationSuggestionCache ??
  new Map<string, { expiresAt: number; suggestions: PlaceSuggestion[] }>();
cacheHost.destinationSuggestionCache = suggestionCache;

function haversineKm(a: Coordinates, b: Coordinates) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDelta = radians(b.lat - a.lat);
  const lngDelta = radians(b.lng - a.lng);
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(value));
}

function travelTimeSuggestion(
  feature: TravelTimeGeocodingFeature,
  index: number,
  query: string,
): PlaceSuggestion {
  const fullName = feature.properties.name || feature.properties.label || "东京地点";
  const [featureName, ...addressParts] = fullName.split(",").map((part) => part.trim());
  const [lng, lat] = feature.geometry.coordinates;
  const isRailway = feature.properties.category === "railway";
  const stationName = query.endsWith("站") || query.endsWith("駅") ? query : `${query}站`;

  return {
    id: `traveltime:${lat.toFixed(6)}:${lng.toFixed(6)}:${index}`,
    name: isRailway
      ? `${stationName} · 定位 ${index + 1}`
      : featureName || fullName,
    address:
      addressParts.join(" · ") ||
      feature.properties.label ||
      [feature.properties.district, feature.properties.city].filter(Boolean).join(" · ") ||
      "Tokyo, Japan",
    category: isRailway ? "车站 / 出入口" : "地点",
    lat: Number(lat),
    lng: Number(lng),
    source: "traveltime",
  };
}

async function searchPhotonPoi(
  query: string,
  category: string,
  center: Coordinates,
  radiusKm = TOKYO_POI_RADIUS_KM,
) {
  const url = new URL("https://photon.komoot.io/api/");
  const lngDelta = Math.min(0.22, Math.max(0.03, radiusKm / 80));
  const latDelta = Math.min(0.18, Math.max(0.025, radiusKm / 100));
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  url.searchParams.set(
    "bbox",
    [
      center.lng - lngDelta,
      center.lat - latDelta,
      center.lng + lngDelta,
      center.lat + latDelta,
    ].join(","),
  );

  const response = await fetch(url, {
    headers: { "User-Agent": "TokyoCommuteFinderDemo/0.1" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return [];

  const data = (await response.json()) as PhotonResponse;
  return (data.features ?? [])
    .filter((feature) => feature.properties.countrycode === "JP")
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const address = [
        feature.properties.street,
        feature.properties.locality,
        feature.properties.district,
        feature.properties.city,
        feature.properties.postcode,
      ].filter(Boolean);
      return {
        suggestion: {
          id: `osm:${feature.properties.osm_type ?? "x"}:${feature.properties.osm_id ?? `${lat}:${lng}`}`,
          name: feature.properties.name || query,
          address: [...new Set(address)].join(" · ") || "Tokyo, Japan",
          category,
          lat: Number(lat),
          lng: Number(lng),
          distanceMeters: Math.round(
            haversineKm(center, { lat: Number(lat), lng: Number(lng) }) * 1000,
          ),
          source: "openstreetmap" as const,
        },
        distance: haversineKm(center, { lat: Number(lat), lng: Number(lng) }),
      };
    })
    .filter((item) => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.suggestion);
}

function deduplicate(suggestions: PlaceSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.name}|${suggestion.address}|${suggestion.lat.toFixed(4)}|${suggestion.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchDestinationSuggestions(rawQuery: string, bias?: Coordinates) {
  const query = rawQuery.trim().slice(0, 80);
  if (query.length < 2) return [];

  const cacheKey = `v6:${query.normalize("NFKC").toLocaleLowerCase()}:${bias ? `${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}` : "tokyo"}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.suggestions;

  const matchedIntent = POI_INTENTS.find((intent) => intent.pattern.test(query));
  const areaQuery = matchedIntent
    ? query.replace(matchedIntent.pattern, "").trim() || "东京"
    : query;
  const queryVariants = getQueryVariants(areaQuery);
  const travelTimeBatches = await Promise.allSettled(
    queryVariants.map((variant) => searchTravelTimeGeocoding(variant, 6)),
  );
  const travelTimeFeatures = travelTimeBatches.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  ).filter((feature, index, all) => all.findIndex((candidate) =>
    Math.abs(candidate.geometry.coordinates[0] - feature.geometry.coordinates[0]) < 0.00002
    && Math.abs(candidate.geometry.coordinates[1] - feature.geometry.coordinates[1]) < 0.00002,
  ) === index).slice(0, 10);
  const travelTimeSuggestions = deduplicate(
    travelTimeFeatures.map((feature, index) =>
      travelTimeSuggestion(feature, index, areaQuery),
    ),
  ).slice(0, 4);
  const firstFeature = travelTimeFeatures[0];
  const center = bias ?? (firstFeature ? {
    lng: Number(firstFeature.geometry.coordinates[0]),
    lat: Number(firstFeature.geometry.coordinates[1]),
  } : TOKYO_CENTER);
  const positionedTravelTimeSuggestions = travelTimeSuggestions.map((suggestion) => ({
    ...suggestion,
    distanceMeters: Math.round(
      haversineKm(center, { lat: suggestion.lat, lng: suggestion.lng }) * 1000,
    ),
  }));
  const shouldSuggestNearbyPoi =
    Boolean(matchedIntent) || firstFeature.properties.category === "railway";
  const poiIntents = matchedIntent
    ? [matchedIntent]
    : shouldSuggestNearbyPoi
      ? [POI_INTENTS[0], POI_INTENTS[1]]
      : [];
  const poiResults = await Promise.allSettled(
    [
      ...getQueryVariants(query).map((variant) =>
        searchPhotonPoi(variant, matchedIntent?.category ?? "地点 / POI", center, bias ? 10 : 25),
      ),
      ...poiIntents.map((intent) =>
        searchPhotonPoi(intent.photonQuery, intent.category, center),
      ),
    ],
  );
  const nearbyPoi = poiResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value.slice(0, 3) : [],
  );

  const normalizedQuery = query.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
  const normalizedVariants = getQueryVariants(query).map((variant) =>
    variant.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, ""),
  );
  const suggestions = deduplicate([
    ...positionedTravelTimeSuggestions,
    ...nearbyPoi,
  ]).sort((a, b) => {
    const aName = a.name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
    const bName = b.name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
    const aMatch = normalizedVariants.some((variant) => aName.includes(variant) || variant.includes(aName)) ? 1 : 0;
    const bMatch = normalizedVariants.some((variant) => bName.includes(variant) || variant.includes(bName)) ? 1 : 0;
    const aLowQuality = /^\d+$/.test(aName) || aName.length < 2 ? 1 : 0;
    const bLowQuality = /^\d+$/.test(bName) || bName.length < 2 ? 1 : 0;
    return bMatch - aMatch || aLowQuality - bLowQuality || (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER);
  }).slice(0, 10);
  suggestionCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    suggestions,
  });

  return suggestions;
}
