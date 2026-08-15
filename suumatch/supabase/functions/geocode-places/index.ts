import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Coordinates = { lat: number; lng: number };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    type?: string;
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "accept, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json; charset=utf-8",
};

const TOKYO_CENTER = { lat: 35.6812, lng: 139.7671 };
const TOKYO_BBOX = [139.45, 35.45, 140.1, 35.92];
const POI_INTENTS = [
  { pattern: /麦当劳|麥當勞|マクドナルド/i, query: "マクドナルド" },
  { pattern: /药妆店?|藥妝店?|ドラッグストア|薬局/i, query: "マツモトキヨシ" },
  { pattern: /星巴克|スターバックス/i, query: "スターバックス" },
  { pattern: /便利店|コンビニ/i, query: "コンビニ" },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function normalizeSearchQuery(query: string) {
  const normalized = query.normalize("NFKC").trim();
  if (/六本木.*森(?:ビル|大厦|大樓)|森(?:ビル|大厦|大樓).*六本木/i.test(normalized)) {
    return "六本木ヒルズ森タワー";
  }
  if (/东京大学|東京大学|东大|東大/i.test(normalized)) {
    return "東京大学 本郷";
  }
  return normalized;
}

function haversineMeters(origin: Coordinates, target: Coordinates) {
  const radians = (value: number) => value * Math.PI / 180;
  const latDelta = radians(target.lat - origin.lat);
  const lngDelta = radians(target.lng - origin.lng);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(origin.lat)) * Math.cos(radians(target.lat)) * Math.sin(lngDelta / 2) ** 2;
  return Math.round(12_742_000 * Math.asin(Math.sqrt(value)));
}

async function photonSearch(query: string, bbox: number[], limit = 10) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("bbox", bbox.join(","));
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TokyoCommuteFinderDemo/1.0 (https://github.com/jiahuicui394-alt/ddd)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Geocoding provider returned HTTP ${response.status}`);
  return ((await response.json()) as PhotonResponse).features ?? [];
}

function featureCoordinates(feature: PhotonFeature): Coordinates {
  return { lat: Number(feature.geometry.coordinates[1]), lng: Number(feature.geometry.coordinates[0]) };
}

function bboxAround(center: Coordinates, radiusKm = 3) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));
  return [center.lng - lngDelta, center.lat - latDelta, center.lng + lngDelta, center.lat + latDelta];
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const requestUrl = new URL(request.url);
  const rawQuery = requestUrl.searchParams.get("q")?.trim() ?? "";
  if (rawQuery.length < 2) return json({ suggestions: [] });
  if (rawQuery.length > 80) return json({ error: "Query is too long" }, 400);

  const latParam = requestUrl.searchParams.get("lat");
  const lngParam = requestUrl.searchParams.get("lng");
  const requestedLat = latParam === null ? Number.NaN : Number(latParam);
  const requestedLng = lngParam === null ? Number.NaN : Number(lngParam);
  const locationBias = Number.isFinite(requestedLat) && Number.isFinite(requestedLng)
    ? { lat: requestedLat, lng: requestedLng }
    : undefined;

  try {
    const normalizedInput = rawQuery.normalize("NFKC").trim();
    const poiIntent = POI_INTENTS.find((intent) => intent.pattern.test(normalizedInput));
    let center = locationBias ?? TOKYO_CENTER;
    let searchTerm = normalizeSearchQuery(normalizedInput);
    let features: PhotonFeature[];

    if (poiIntent) {
      const areaQuery = normalizedInput.replace(poiIntent.pattern, "").trim();
      if (areaQuery) {
        const areaFeatures = await photonSearch(areaQuery, TOKYO_BBOX, 5);
        const areaCenter = areaFeatures[0] && featureCoordinates(areaFeatures[0]);
        if (areaCenter && Number.isFinite(areaCenter.lat) && Number.isFinite(areaCenter.lng)) center = areaCenter;
      }
      searchTerm = poiIntent.query;
      features = await photonSearch(searchTerm, bboxAround(center), 10);
    } else {
      features = await photonSearch(searchTerm, locationBias ? bboxAround(center, 25) : TOKYO_BBOX, 10);
    }

    const normalizedSearch = searchTerm.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
    const suggestions = features.map((feature) => {
      const coords = featureCoordinates(feature);
      const addressParts = [
        feature.properties.street,
        feature.properties.locality,
        feature.properties.district,
        feature.properties.city,
        feature.properties.state,
        feature.properties.postcode,
      ].filter((value): value is string => Boolean(value));
      return {
        id: `osm:${feature.properties.osm_type ?? "x"}:${feature.properties.osm_id ?? `${coords.lat}:${coords.lng}`}`,
        name: feature.properties.name || searchTerm,
        address: [...new Set(addressParts)].join(" · ") || "Tokyo, Japan",
        category: feature.properties.type || "place",
        lat: coords.lat,
        lng: coords.lng,
        distanceMeters: haversineMeters(center, coords),
        source: "openstreetmap",
      };
    }).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
      .sort((left, right) => {
        const leftName = left.name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
        const rightName = right.name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
        const leftMatch = leftName === normalizedSearch ? 2 : leftName.includes(normalizedSearch) ? 1 : 0;
        const rightMatch = rightName === normalizedSearch ? 2 : rightName.includes(normalizedSearch) ? 1 : 0;
        return rightMatch - leftMatch || left.distanceMeters - right.distanceMeters;
      });

    return json({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocoding failed";
    return json({ error: message }, 502);
  }
});
