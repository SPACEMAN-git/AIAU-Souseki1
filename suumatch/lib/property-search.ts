import "server-only";

import {
  COMMUTE_BUFFER_MINUTES,
  MAX_ORIGIN_WALK_MINUTES,
  MAX_RECOMMENDED_PROPERTIES,
  MAX_RECOMMENDED_STATIONS,
  MAX_ROUTE_WALK_MINUTES,
} from "./commute-policy";
import type { PropertyMatch, ReachableStation } from "./commute-types";
import { getSupabaseClient } from "./supabase";

type PropertyStationRow = {
  walk_minutes: number;
  station: {
    station_key: string;
    name_ja: string;
    name_zh: string;
  };
  property: {
    id: string;
    slug: string;
    title: string;
    address: string;
    monthly_rent_yen: number;
    management_fee_yen: number;
    layout: string;
    area_sqm: number;
    building_age_years: number;
    floor: number;
    image_url: string | null;
    source_url: string | null;
    nearest_supermarket_walk_minutes: number | null;
    supermarkets_within_10min: number | null;
    convenience_stores_within_10min: number | null;
    restaurants_within_10min: number | null;
    lifestyle_data_source: "generated_mock" | "real_poi" | null;
    pet_friendly: boolean;
    bath_toilet_separate: boolean;
    nearest_major_area: string | null;
    major_area_walk_minutes: number | null;
    amenity_data_source: "generated_mock" | "verified" | null;
    available: boolean;
  };
};

export type PropertySearchResult = {
  recommendedStations: ReachableStation[];
  properties: PropertyMatch[];
};

export async function findMatchingProperties(
  reachableStations: ReachableStation[],
  maxMinutes: number,
  maxMonthlyCostYen = 500000,
): Promise<PropertySearchResult> {
  const supabase = getSupabaseClient();
  if (!supabase || reachableStations.length === 0) {
    return { recommendedStations: [], properties: [] };
  }

  const reachableByKey = new Map(
    reachableStations.map((station) => [station.id, station]),
  );
  const reachableKeys = [...reachableByKey.keys()];

  const { data: stationRows, error: stationError } = await supabase
    .from("stations")
    .select("id")
    .in("station_key", reachableKeys);

  if (stationError) {
    throw new Error(`Supabase station query failed: ${stationError.message}`);
  }

  const stationIds = (stationRows ?? []).map((station) => station.id as string);
  if (stationIds.length === 0) {
    return { recommendedStations: [], properties: [] };
  }

  const { data, error } = await supabase
    .from("property_stations")
    .select(`
      walk_minutes,
      station:stations!inner(station_key, name_ja, name_zh),
      property:properties!inner(
        id, slug, title, address, monthly_rent_yen, management_fee_yen,
        layout, area_sqm, building_age_years, floor, image_url, source_url,
        nearest_supermarket_walk_minutes, supermarkets_within_10min,
        convenience_stores_within_10min, restaurants_within_10min,
        lifestyle_data_source, pet_friendly, bath_toilet_separate,
        nearest_major_area, major_area_walk_minutes, amenity_data_source, available
      )
    `)
    .eq("property.available", true)
    .in("station_id", stationIds);

  if (error) throw new Error(`Supabase property query failed: ${error.message}`);

  const effectiveLimit = Math.max(7, maxMinutes - COMMUTE_BUFFER_MINUTES);
  const matches: PropertyMatch[] = [];

  for (const row of (data ?? []) as unknown as PropertyStationRow[]) {
    const reachableStation = reachableByKey.get(row.station.station_key);
    if (!reachableStation) continue;
    if (row.property.monthly_rent_yen + row.property.management_fee_yen > maxMonthlyCostYen) continue;
    if (row.walk_minutes > MAX_ORIGIN_WALK_MINUTES) continue;
    if (reachableStation.walkingMinutes > MAX_ROUTE_WALK_MINUTES) continue;
    if (reachableStation.transfers > 1) continue;

    const finalMinutes = reachableStation.totalMinutes + row.walk_minutes;
    if (finalMinutes > effectiveLimit) continue;

    matches.push({
      id: row.property.id,
      slug: row.property.slug,
      title: row.property.title,
      address: row.property.address,
      monthlyRentYen: row.property.monthly_rent_yen,
      managementFeeYen: row.property.management_fee_yen,
      layout: row.property.layout,
      areaSqm: Number(row.property.area_sqm),
      buildingAgeYears: row.property.building_age_years,
      floor: row.property.floor,
      imageUrl: row.property.image_url,
      sourceUrl: row.property.source_url,
      lifestyle: {
        nearestSupermarketWalkMinutes: row.property.nearest_supermarket_walk_minutes,
        supermarketsWithin10Minutes: row.property.supermarkets_within_10min,
        convenienceStoresWithin10Minutes: row.property.convenience_stores_within_10min,
        restaurantsWithin10Minutes: row.property.restaurants_within_10min,
        dataSource: row.property.lifestyle_data_source,
      },
      amenities: {
        petFriendly: row.property.pet_friendly,
        bathToiletSeparate: row.property.bath_toilet_separate,
        nearestMajorArea: row.property.nearest_major_area,
        majorAreaWalkMinutes: row.property.major_area_walk_minutes,
        dataSource: row.property.amenity_data_source,
      },
      station: {
        key: row.station.station_key,
        name: row.station.name_zh,
        nameJa: row.station.name_ja,
        walkingMinutes: row.walk_minutes,
      },
      commute: {
        propertyWalkMinutes: row.walk_minutes,
        stationToDestinationMinutes: reachableStation.totalMinutes,
        finalMinutes,
        route: reachableStation.route,
      },
    });
  }

  const propertiesByStation = new Map<string, PropertyMatch[]>();
  for (const property of matches) {
    const stationProperties = propertiesByStation.get(property.station.key) ?? [];
    stationProperties.push(property);
    propertiesByStation.set(property.station.key, stationProperties);
  }

  const recommendedStations = reachableStations
    .flatMap((station) => {
      const stationProperties = propertiesByStation.get(station.id);
      if (!stationProperties?.length) return [];

      const sortedProperties = stationProperties.sort(
        (a, b) =>
          a.commute.finalMinutes - b.commute.finalMinutes ||
          a.monthlyRentYen - b.monthlyRentYen,
      );
      const bestProperty = sortedProperties[0];

      return [{
        ...station,
        propertyCount: sortedProperties.length,
        bestPropertyWalkMinutes: bestProperty.commute.propertyWalkMinutes,
        bestDoorToDoorMinutes: bestProperty.commute.finalMinutes,
        rentHint: `${sortedProperties.length} 套 Mock 房源`,
      }];
    })
    .sort(
      (a, b) =>
        (a.bestDoorToDoorMinutes * 4 + a.totalMinutes + a.transfers * 4 - a.majorHubScore * 0.035) -
          (b.bestDoorToDoorMinutes * 4 + b.totalMinutes + b.transfers * 4 - b.majorHubScore * 0.035) ||
        a.bestDoorToDoorMinutes - b.bestDoorToDoorMinutes ||
        a.transfers - b.transfers ||
        a.walkingMinutes - b.walkingMinutes,
    )
    .slice(0, MAX_RECOMMENDED_STATIONS);

  const recommendedStationKeys = new Set(
    recommendedStations.map((station) => station.id),
  );
  const properties = matches
    .filter((property) => recommendedStationKeys.has(property.station.key))
    .sort(
      (a, b) =>
        a.commute.finalMinutes - b.commute.finalMinutes ||
        a.monthlyRentYen - b.monthlyRentYen,
    )
    .slice(0, MAX_RECOMMENDED_PROPERTIES);

  return { recommendedStations, properties };
}
