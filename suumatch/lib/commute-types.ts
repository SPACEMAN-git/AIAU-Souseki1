export type NearbyStation = {
  id: string;
  name: string;
  nameJa: string;
  lines: string[];
  walkingMinutes: number;
  accent: string;
};

export type ReachableStation = {
  id: string;
  name: string;
  nameJa: string;
  lines: string[];
  transitMinutes: number;
  walkingMinutes: number;
  totalMinutes: number;
  transfers: number;
  route: string;
  rentHint: string;
  propertyCount: number;
  bestPropertyWalkMinutes: number;
  bestDoorToDoorMinutes: number;
  majorHubScore: number;
  nearestMajorHub: string;
  majorHubDistanceKm: number;
  direction: "north" | "east" | "south" | "west";
};

export type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  source: "traveltime" | "openstreetmap";
};

export type PropertyMatch = {
  id: string;
  slug: string;
  title: string;
  address: string;
  monthlyRentYen: number;
  managementFeeYen: number;
  layout: string;
  areaSqm: number;
  buildingAgeYears: number;
  floor: number;
  imageUrl: string | null;
  sourceUrl: string | null;
  lifestyle: {
    nearestSupermarketWalkMinutes: number | null;
    supermarketsWithin10Minutes: number | null;
    convenienceStoresWithin10Minutes: number | null;
    restaurantsWithin10Minutes: number | null;
    dataSource: "generated_mock" | "real_poi" | null;
  };
  amenities?: {
    petFriendly: boolean;
    bathToiletSeparate: boolean;
    nearestMajorArea: string | null;
    majorAreaWalkMinutes: number | null;
    dataSource: "generated_mock" | "verified" | null;
  };
  station: {
    key: string;
    name: string;
    nameJa: string;
    walkingMinutes: number;
  };
  commute: {
    propertyWalkMinutes: number;
    stationToDestinationMinutes: number;
    finalMinutes: number;
    route: string;
  };
};

export type CommuteSearchResponse = {
  destination: {
    name: string;
    subtitle: string;
    lat: number;
    lng: number;
  };
  requestedMinutes: number;
  candidateStationCount: number;
  commuteBufferMinutes: number;
  nearbyStations: NearbyStation[];
  selectedNearbyStationId?: string;
  reachableStations: ReachableStation[];
  properties: PropertyMatch[];
  propertySource: "supabase" | "unavailable";
  generatedAt: string;
  source: "demo" | "api";
  note?: string;
};
