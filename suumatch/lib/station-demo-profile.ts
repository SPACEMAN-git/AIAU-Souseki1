import type { ReachableStation } from "./commute-types";

export type StationProfileLabelKey =
  | "livable"
  | "affordable"
  | "connected"
  | "safe"
  | "lively"
  | "quiet";

export type StationDemoProfile = {
  labels: [StationProfileLabelKey, StationProfileLabelKey];
  averageRentYen: number;
  dataSource: "generated_mock";
};

const PREMIUM_AREA_PATTERN = /銀座|银座|六本木|麻布|表参道|恵比寿|惠比寿|東京|东京|赤坂|広尾|广尾/;

function stableHash(value: string) {
  return [...value].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
}

export function getStationDemoProfile(station: ReachableStation): StationDemoProfile {
  const seed = stableHash(`${station.id}:${station.nameJa}`);
  const isPremiumArea = PREMIUM_AREA_PATTERN.test(`${station.name}:${station.nameJa}`);
  const hubPremium = station.majorHubDistanceKm <= 1.5 ? 18000 : station.majorHubScore >= 60 ? 9000 : 0;
  const areaPremium = isPremiumArea ? 36000 : 0;
  const averageRentYen = Math.min(
    198000,
    Math.max(72000, Math.round((82000 + (seed % 36000) + hubPremium + areaPremium) / 1000) * 1000),
  );

  const labels: StationProfileLabelKey[] = [];
  if (station.transfers === 0 || station.majorHubScore >= 55) labels.push("connected");
  if (averageRentYen <= 108000) labels.push("affordable");
  if (station.majorHubDistanceKm <= 2.2) labels.push("lively");

  const lifestyleLabels: StationProfileLabelKey[] = ["livable", "safe", "quiet"];
  for (let index = 0; labels.length < 2; index += 1) {
    const label = lifestyleLabels[(seed + index) % lifestyleLabels.length];
    if (!labels.includes(label)) labels.push(label);
  }

  return {
    labels: [labels[0], labels[1]],
    averageRentYen,
    dataSource: "generated_mock",
  };
}
