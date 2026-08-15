import "server-only";

import type {
  CommuteSearchResponse,
  NearbyStation,
  ReachableStation,
} from "./commute-types";
import {
  COMMUTE_BUFFER_MINUTES,
  MAX_DESTINATION_WALK_MINUTES,
} from "./commute-policy";
import { getTokyoStations, type TokyoStation } from "./station-catalog";

const TRAVELTIME_API_BASE = "https://api.traveltimeapp.com/v4";
const DESTINATION_ID = "destination";
const WALKING_SEARCH_ID = "nearby-destination-stations";
const TRANSIT_SEARCH_ID = "reachable-tokyo-stations";
const MAJOR_HUB_NAMES = ["渋谷", "新宿", "池袋"];

const DESTINATION_GEOCODING_ALIASES: Record<string, string> = {
  东京大学: "東京大学 本郷キャンパス",
  东京大学本乡校区: "東京大学 本郷キャンパス",
  东大: "東京大学 本郷キャンパス",
  東大: "東京大学 本郷キャンパス",
};

type SearchInput = {
  destination: string;
  maxMinutes: number;
  destinationStationId?: string;
  destinationPlace?: {
    lat: number;
    lng: number;
    address: string;
  };
};

type Coordinates = { lat: number; lng: number };

type TravelTimeProperty = {
  travel_time?: number;
  distance?: number;
  route?: {
    parts?: Array<{
      type?: string;
      mode?: string;
      directions?: string;
      travel_time?: number;
    }>;
  };
};

type TimeFilterResponse = {
  results?: Array<{
    search_id: string;
    locations: Array<{
      id: string;
      properties: TravelTimeProperty[];
    }>;
    unreachable: string[];
  }>;
};

export type TravelTimeGeocodingFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    label?: string;
    city?: string;
    district?: string;
    category?: string;
  };
};

type GeocodingResponse = {
  features?: Array<{
    geometry: TravelTimeGeocodingFeature["geometry"];
    properties: TravelTimeGeocodingFeature["properties"];
  }>;
};

type TravelTimeErrorBody = {
  description?: string;
  error_code?: number;
};

export function hasExternalProvider() {
  return Boolean(process.env.TRAVELTIME_APP_ID && process.env.TRAVELTIME_API_KEY);
}

function getCredentials() {
  const appId = process.env.TRAVELTIME_APP_ID;
  const apiKey = process.env.TRAVELTIME_API_KEY;

  if (!appId || !apiKey) {
    throw new Error(
      "TravelTime 尚未配置。请在 .env.local 中填写 TRAVELTIME_APP_ID 和 TRAVELTIME_API_KEY。",
    );
  }

  return { appId, apiKey };
}

async function travelTimeFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { appId, apiKey } = getCredentials();
  const response = await fetch(`${TRAVELTIME_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Application-Id": appId,
      "X-Api-Key": apiKey,
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as TravelTimeErrorBody;
    const detail = body.description || `HTTP ${response.status}`;
    throw new Error(`TravelTime API 请求失败：${detail}`);
  }

  return (await response.json()) as T;
}

export async function searchTravelTimeGeocoding(query: string, limit = 5) {
  const normalizedQuery = query.trim().replace(/\s+/g, "");
  const geocodingQuery = DESTINATION_GEOCODING_ALIASES[normalizedQuery] ?? query;
  const params = new URLSearchParams({
    query: `${geocodingQuery}, Tokyo, Japan`,
    "within.country": "JP",
    limit: String(limit),
    "format.name": "true",
  });
  const result = await travelTimeFetch<GeocodingResponse>(
    `/geocoding/search?${params.toString()}`,
    { headers: { "Accept-Language": "ja-JP" } },
  );
  return result.features ?? [];
}

async function geocodeDestination(query: string) {
  const feature = (await searchTravelTimeGeocoding(query, 1))[0];

  if (!feature) throw new Error(`找不到目的地“${query}”，请尝试输入更完整的地址。`);

  return {
    name: query,
    subtitle:
      feature.properties.name ||
      feature.properties.label ||
      [feature.properties.city, feature.properties.district].filter(Boolean).join(" · ") ||
      "Tokyo, Japan",
    coords: {
      lng: Number(feature.geometry.coordinates[0]),
      lat: Number(feature.geometry.coordinates[1]),
    },
  };
}

function getNextWeekdayArrivalTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const tokyoParts = formatter.formatToParts(now);
  const part = (type: string) => tokyoParts.find((item) => item.type === type)?.value ?? "";
  const nextDate = new Date(
    Date.UTC(
      Number(part("year")),
      Number(part("month")) - 1,
      Number(part("day")),
    ),
  );
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  while ([0, 6].includes(nextDate.getUTCDay())) {
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  }

  return `${nextDate.toISOString().slice(0, 10)}T09:00:00+09:00`;
}

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

function getNearbyCandidates(stations: TokyoStation[], destination: Coordinates) {
  const sorted = [...stations].sort(
    (a, b) =>
      haversineKm({ lat: a.latitude, lng: a.longitude }, destination) -
      haversineKm({ lat: b.latitude, lng: b.longitude }, destination),
  );
  const withinThreeKm = sorted.filter(
    (station) =>
      haversineKm({ lat: station.latitude, lng: station.longitude }, destination) <= 3,
  );
  return (withinThreeKm.length >= 3 ? withinThreeKm : sorted).slice(0, 6);
}

function locationId(station: TokyoStation) {
  return `station:${station.stationKey}`;
}

function stationKeyFromLocationId(id: string) {
  return id.replace(/^station:/, "");
}

function getDirection(station: TokyoStation, destination: Coordinates): ReachableStation["direction"] {
  const latDelta = station.latitude - destination.lat;
  const lngDelta = station.longitude - destination.lng;
  if (Math.abs(latDelta) >= Math.abs(lngDelta)) return latDelta >= 0 ? "north" : "south";
  return lngDelta >= 0 ? "east" : "west";
}

function getMajorHubAccess(station: TokyoStation, majorHubs: TokyoStation[]) {
  const nearest = majorHubs
    .map((hub) => ({
      hub,
      distanceKm: haversineKm(
        { lat: station.latitude, lng: station.longitude },
        { lat: hub.latitude, lng: hub.longitude },
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  if (!nearest) return { majorHubScore: 0, nearestMajorHub: "", majorHubDistanceKm: 99 };
  return {
    majorHubScore: Math.round(Math.max(0, 100 - nearest.distanceKm * 12)),
    nearestMajorHub: nearest.hub.nameJa,
    majorHubDistanceKm: Number(nearest.distanceKm.toFixed(1)),
  };
}

function getRouteSummary(property: TravelTimeProperty, station: TokyoStation) {
  const parts = property.route?.parts ?? [];
  const transitParts = parts.filter((part) => part.type === "public_transport");
  const walkingSeconds = parts
    .filter((part) => part.mode === "walk" || part.type === "start_end")
    .reduce((total, part) => total + (part.travel_time ?? 0), 0);
  const directions = transitParts
    .map((part) => part.directions)
    .filter((value): value is string => Boolean(value));

  return {
    transfers: Math.max(0, transitParts.length - 1),
    walkingMinutes: Math.ceil(walkingSeconds / 60),
    route: directions.length > 0 ? directions.slice(0, 2).join(" → ") : `${station.nameJa} → 目的地`,
  };
}

function stationAccent(index: number) {
  return ["#48a999", "#e95d55", "#6b8fc6", "#c69b43", "#8a73b8", "#4c9b62"][index % 6];
}

async function calculateTravelTimes(
  stations: TokyoStation[],
  nearbyCandidates: TokyoStation[],
  transitCandidates: TokyoStation[],
  destinationStation: TokyoStation | undefined,
  destination: Coordinates,
  maxMinutes: number,
  arrivalTime: string,
) {
  const requestBody = {
    locations: [
      { id: DESTINATION_ID, coords: destination },
      ...stations.map((station) => ({
        id: locationId(station),
        coords: { lat: station.latitude, lng: station.longitude },
      })),
    ],
    arrival_searches: [
      {
        id: WALKING_SEARCH_ID,
        departure_location_ids: nearbyCandidates.map(locationId),
        arrival_location_id: DESTINATION_ID,
        arrival_time: arrivalTime,
        travel_time: MAX_DESTINATION_WALK_MINUTES * 60,
        properties: ["travel_time", "distance"],
        transportation: { type: "walking" },
      },
      {
        id: TRANSIT_SEARCH_ID,
        departure_location_ids: transitCandidates.map(locationId),
        arrival_location_id: destinationStation
          ? locationId(destinationStation)
          : DESTINATION_ID,
        arrival_time: arrivalTime,
        travel_time: Math.max(5, maxMinutes - COMMUTE_BUFFER_MINUTES) * 60,
        properties: ["travel_time", "route"],
        transportation: { type: "train" },
        range: { enabled: true, max_results: 1, width: 1800 },
      },
    ],
  };

  return travelTimeFetch<TimeFilterResponse>("/time-filter", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export async function searchExternalProvider(input: SearchInput): Promise<CommuteSearchResponse> {
  const [destination, stations] = await Promise.all([
    input.destinationPlace
      ? Promise.resolve({
          name: input.destination,
          subtitle: input.destinationPlace.address,
          coords: {
            lat: input.destinationPlace.lat,
            lng: input.destinationPlace.lng,
          },
        })
      : geocodeDestination(input.destination),
    getTokyoStations(),
  ]);

  if (stations.length === 0) throw new Error("Supabase 中没有可用于计算的东京车站数据。");

  const nearbyCandidates = getNearbyCandidates(stations, destination.coords);
  const destinationStation = input.destinationStationId
    ? nearbyCandidates.find(
        (station) => station.stationKey === input.destinationStationId,
      )
    : undefined;

  if (input.destinationStationId && !destinationStation) {
    throw new Error("所选车站不在当前目的地附近，请重新选择。");
  }

  const transitCandidates = destinationStation
    ? stations.filter(
        (station) =>
          station.stationKey !== destinationStation.stationKey &&
          station.lines.some((line) => destinationStation.lines.includes(line)),
      )
    : stations;
  const arrivalTime = getNextWeekdayArrivalTime();
  const matrix = await calculateTravelTimes(
    stations,
    nearbyCandidates,
    transitCandidates,
    destinationStation,
    destination.coords,
    input.maxMinutes,
    arrivalTime,
  );
  const byKey = new Map(stations.map((station) => [station.stationKey, station]));
  const majorHubs = stations.filter((station) => MAJOR_HUB_NAMES.includes(station.nameJa));
  const walkingResult = matrix.results?.find((result) => result.search_id === WALKING_SEARCH_ID);
  const transitResult = matrix.results?.find((result) => result.search_id === TRANSIT_SEARCH_ID);

  const nearbyStations: NearbyStation[] = (walkingResult?.locations ?? [])
    .map((location, index) => {
      const station = byKey.get(stationKeyFromLocationId(location.id));
      const property = location.properties[0];
      if (!station || property?.travel_time == null) return null;
      return {
        id: station.stationKey,
        name: station.nameZh,
        nameJa: station.nameJa,
        lines: station.lines,
        walkingMinutes: Math.max(1, Math.ceil(property.travel_time / 60)),
        accent: stationAccent(index),
      };
    })
    .filter((station): station is NearbyStation =>
      station !== null && station.walkingMinutes <= MAX_DESTINATION_WALK_MINUTES,
    )
    .sort((a, b) => a.walkingMinutes - b.walkingMinutes);

  const selectedNearbyStation = destinationStation
    ? nearbyStations.find((station) => station.id === destinationStation.stationKey)
    : undefined;

  if (destinationStation && !selectedNearbyStation) {
    throw new Error(`无法计算${destinationStation.nameZh}站到目的地的步行时间。`);
  }

  const transitReachableStations: ReachableStation[] = (transitResult?.locations ?? [])
    .map((location) => {
      const station = byKey.get(stationKeyFromLocationId(location.id));
      const property = location.properties[0];
      if (!station || property?.travel_time == null) return null;
      const railMinutes = Math.max(1, Math.ceil(property.travel_time / 60));
      const route = getRouteSummary(property, station);
      const destinationWalkMinutes = selectedNearbyStation?.walkingMinutes ?? 0;
      const totalMinutes = railMinutes + destinationWalkMinutes;
      const hubAccess = getMajorHubAccess(station, majorHubs);
      return {
        id: station.stationKey,
        name: station.nameZh,
        nameJa: station.nameJa,
        lines: station.lines,
        transitMinutes: destinationStation
          ? railMinutes
          : Math.max(0, railMinutes - route.walkingMinutes),
        walkingMinutes: destinationStation
          ? destinationWalkMinutes
          : route.walkingMinutes,
        totalMinutes,
        transfers: route.transfers,
        route: destinationStation
          ? `${station.nameZh} → ${destinationStation.nameZh}（铁路 ${railMinutes} 分）→ 步行 ${destinationWalkMinutes} 分`
          : route.route,
        rentHint: "3 套 Mock 房源",
        propertyCount: 0,
        bestPropertyWalkMinutes: 0,
        bestDoorToDoorMinutes: totalMinutes,
        ...hubAccess,
        direction: getDirection(station, destination.coords),
      };
    })
    .filter((station): station is ReachableStation => station !== null);

  const accessStationAsOrigin: ReachableStation[] = destinationStation && selectedNearbyStation
    ? [{
        ...getMajorHubAccess(destinationStation, majorHubs),
        id: destinationStation.stationKey,
        name: destinationStation.nameZh,
        nameJa: destinationStation.nameJa,
        lines: destinationStation.lines,
        transitMinutes: 0,
        walkingMinutes: selectedNearbyStation.walkingMinutes,
        totalMinutes: selectedNearbyStation.walkingMinutes,
        transfers: 0,
        route: `${destinationStation.nameZh}站 → 步行 ${selectedNearbyStation.walkingMinutes} 分钟到目的地`,
        rentHint: "3 套 Mock 房源",
        propertyCount: 0,
        bestPropertyWalkMinutes: 0,
        bestDoorToDoorMinutes: selectedNearbyStation.walkingMinutes,
        direction: getDirection(destinationStation, destination.coords),
      }]
    : [];

  const reachableStations = [...accessStationAsOrigin, ...transitReachableStations]
    .sort((a, b) => a.totalMinutes - b.totalMinutes);

  return {
    destination: {
      name: destination.name,
      subtitle: destination.subtitle,
      lat: destination.coords.lat,
      lng: destination.coords.lng,
    },
    requestedMinutes: input.maxMinutes,
    candidateStationCount: reachableStations.length,
    commuteBufferMinutes: COMMUTE_BUFFER_MINUTES,
    nearbyStations,
    selectedNearbyStationId: selectedNearbyStation?.id,
    reachableStations,
    properties: [],
    propertySource: "unavailable",
    generatedAt: new Date().toISOString(),
    source: "api",
    note: "TravelTime 实时计算 · 工作日上午 9:00 前到达 · 车站数据来自 HeartRails Express",
  };
}
