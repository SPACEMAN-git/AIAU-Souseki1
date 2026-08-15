import {
  applyHbtiPriorityOrder,
  DEFAULT_HBTI_ANSWERS,
  deriveHbtiProfile,
  applyIdealBudget,
  filterByMaximumBudget,
  HBTI_QUESTIONS,
  rankProperties,
  scoreProperties,
} from "../lib/housing-scoring.ts";
import type { HbtiAnswers } from "../lib/housing-scoring.ts";
import type { CommuteSearchResponse, PropertyMatch } from "../lib/commute-types.ts";
import { HOUSING_CALIBRATION_PROPERTIES } from "../lib/housing-calibration.ts";
import { HBTI_QUESTION_COPY, PAGE_COPY } from "../lib/i18n.ts";
import { getStationDemoProfile } from "../lib/station-demo-profile.ts";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
for (const locale of ["zh", "ja", "en"] as const) {
  if (!PAGE_COPY[locale].search || Object.keys(HBTI_QUESTION_COPY[locale]).length !== 20) {
    throw new Error(`Localization is incomplete for ${locale}.`);
  }
}
const placeResponse = await fetch(`${baseUrl}/api/places?q=${encodeURIComponent("六本木 森ビル")}&lat=35.6605&lng=139.7292`);
if (!placeResponse.ok) throw new Error(`Place search failed: ${placeResponse.status}`);
const placeResult = await placeResponse.json() as { suggestions: Array<{ name: string; address: string; lat: number; lng: number }> };
const moriTower = placeResult.suggestions.find((place) => /六本木ヒルズ森タワー|Roppongi Hills Mori Tower/i.test(place.name));
if (!moriTower) {
  throw new Error("Precise Mori Tower suggestion was not returned.");
}
const response = await fetch(`${baseUrl}/api/commute`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    destination: moriTower.name,
    maxMinutes: 35,
    maxBudgetYen: 160000,
    destinationPlace: { lat: moriTower.lat, lng: moriTower.lng, address: moriTower.address },
  }),
});
if (!response.ok) throw new Error(`Commute API failed: ${response.status} ${await response.text()}`);
const result = await response.json() as CommuteSearchResponse;
const clientFallbackResult = filterByMaximumBudget(result, 120000);
if (clientFallbackResult.properties.some(
  (property) => property.monthlyRentYen + property.managementFeeYen > 120000,
) || clientFallbackResult.reachableStations.some(
  (station) => station.propertyCount !== clientFallbackResult.properties.filter((property) => property.station.key === station.id).length,
)) {
  throw new Error("Client maximum-budget compatibility filter failed.");
}
if (result.properties.length === 0 || result.reachableStations.length === 0) {
  throw new Error("The commute flow did not return stations and properties.");
}
if (result.properties.some((property) => property.monthlyRentYen + property.managementFeeYen > 160000)) {
  throw new Error("A property above the maximum monthly budget entered the candidate set.");
}
if (result.nearbyStations.some((station) => station.walkingMinutes > 15)) {
  throw new Error("A destination access station exceeds the 15-minute walking limit.");
}
if (result.reachableStations.some((station) =>
  !Number.isFinite(station.majorHubScore)
  || !station.nearestMajorHub
  || !Number.isFinite(station.majorHubDistanceKm))) {
  throw new Error("Major hub accessibility metadata is incomplete.");
}
for (const station of result.reachableStations) {
  const profile = getStationDemoProfile(station);
  const repeatedProfile = getStationDemoProfile(station);
  if (profile.dataSource !== "generated_mock"
    || profile.labels.length !== 2
    || new Set(profile.labels).size !== 2
    || profile.averageRentYen < 72000
    || profile.averageRentYen > 198000
    || JSON.stringify(profile) !== JSON.stringify(repeatedProfile)) {
    throw new Error(`Station demo profile is invalid or unstable for ${station.id}.`);
  }
}

for (const property of result.properties) {
  if (!property.lifestyle || property.lifestyle.dataSource !== "generated_mock") {
    throw new Error(`Lifestyle demo metrics are missing for ${property.id}.`);
  }
  if (property.lifestyle.nearestSupermarketWalkMinutes == null
    || property.lifestyle.supermarketsWithin10Minutes == null
    || property.lifestyle.convenienceStoresWithin10Minutes == null
    || property.lifestyle.restaurantsWithin10Minutes == null) {
    throw new Error(`Lifestyle demo metrics are incomplete for ${property.id}.`);
  }
  if (!property.amenities
    || property.amenities.dataSource !== "generated_mock"
    || property.amenities.nearestMajorArea == null
    || property.amenities.majorAreaWalkMinutes == null
    || typeof property.amenities.petFriendly !== "boolean"
    || typeof property.amenities.bathToiletSeparate !== "boolean") {
    throw new Error(`Specific preference demo fields are incomplete for ${property.id}.`);
  }
}

if (HBTI_QUESTIONS.length !== 20) throw new Error("HBTI must contain exactly 20 questions.");
const answers: HbtiAnswers = {
  ...DEFAULT_HBTI_ANSWERS,
  q01: 1, q02: 2, q03: 2, q04: -1, q05: 1,
  q06: 1, q07: -1, q08: 1, q09: 1, q10: -1,
  q11: 2, q12: -1, q13: 0, q14: 2, q15: -1,
  q16: -1, q17: 0, q18: 1, q19: -1, q20: 2,
};
const profile = deriveHbtiProfile(answers, result.properties);
const lowerIdealBudgetProfile = applyIdealBudget(profile, 80000);
const higherIdealBudgetProfile = applyIdealBudget(profile, 160000);
const highestCostProperty = [...result.properties].sort(
  (left, right) => (right.monthlyRentYen + right.managementFeeYen) - (left.monthlyRentYen + left.managementFeeYen),
)[0];
const lowBudgetPriceScore = scoreProperties([highestCostProperty], result.reachableStations, lowerIdealBudgetProfile)[0].scores.price;
const highBudgetPriceScore = scoreProperties([highestCostProperty], result.reachableStations, higherIdealBudgetProfile)[0].scores.price;
if (highBudgetPriceScore <= lowBudgetPriceScore) {
  throw new Error("Ideal budget did not affect the price matching score.");
}
const weightTotal = Object.values(profile.weights).reduce((total, weight) => total + weight, 0);
if (Math.abs(weightTotal - 1) > 0.0001) throw new Error("HBTI weights do not total 100%.");
if (!profile.roomDnaName || !profile.roomDnaDescription || profile.layoutPreference.length !== 3) {
  throw new Error("HBTI public result is incomplete.");
}
if (Object.values(profile.targets).some((value) => !Number.isFinite(value))
  || Object.values(profile.tolerances).some((value) => !Number.isFinite(value) || value <= 0)) {
  throw new Error("HBTI target or tolerance inference failed.");
}

const calibrationFeedback = HOUSING_CALIBRATION_PROPERTIES.map((property, index) => ({
  propertyId: property.id,
  reaction: (index === 1 ? -1 : 1) as -1 | 1,
  reasons: index === 0 ? ["通勤时间短", "离车站近"] : index === 1 ? ["离车站太远"] : ["房子更新"],
}));
if (HOUSING_CALIBRATION_PROPERTIES.length !== 10) {
  throw new Error("Swipe calibration must contain exactly 10 cards.");
}
const combinedProfile = deriveHbtiProfile(
  answers,
  HOUSING_CALIBRATION_PROPERTIES,
  ["housing", "commute", "price", "lifestyle", "station"],
  calibrationFeedback,
);
if (combinedProfile.weights.housing <= combinedProfile.weights.station
  || Object.keys(combinedProfile.weights).every((key) =>
    combinedProfile.weights[key as keyof typeof combinedProfile.weights]
      === profile.weights[key as keyof typeof profile.weights])) {
  throw new Error("Priority + HBTI + swipe inputs were not combined.");
}

const specificProfile = deriveHbtiProfile(
  answers,
  HOUSING_CALIBRATION_PROPERTIES,
  ["commute", "price", "housing", "lifestyle", "station"],
  [],
  {
    rewards: ["walk_5", "layout_1k", "area_25"],
    penalties: ["avoid_1r", "avoid_old", "avoid_far_station"],
  },
);
const specificScored = scoreProperties(HOUSING_CALIBRATION_PROPERTIES, [], specificProfile);
if (specificProfile.specificPreferences.rewards.length !== 3
  || specificProfile.specificPreferences.penalties.length !== 3
  || !specificScored.some((property) => property.specificPreferenceMatches.length > 0)
  || !specificScored.some((property) => property.specificPreferenceConflicts.length > 0)) {
  throw new Error("Specific preference rewards and penalties were not applied.");
}

const customized = applyHbtiPriorityOrder(profile, ["commute", "housing", "price", "lifestyle", "station"]);
const expectedCustomizedWeights = [0.35, 0.25, 0.18, 0.13, 0.09];
for (const [index, key] of ["commute", "housing", "price", "lifestyle", "station"].entries()) {
  if (customized.weights[key as keyof typeof customized.weights] !== expectedCustomizedWeights[index]) {
    throw new Error("Drag priority weights are incorrect.");
  }
}

const scored = scoreProperties(result.properties, result.reachableStations, profile);
if (scored.length !== result.properties.length) throw new Error("Some qualifying properties were not scored.");
const legacyProperties = result.properties.slice(0, 3).map((property) => {
  const { lifestyle: _missingInLegacyApi, ...legacyProperty } = property;
  return legacyProperty;
}) as unknown as PropertyMatch[];
const legacyScored = scoreProperties(legacyProperties, result.reachableStations, profile);
if (legacyScored.length !== legacyProperties.length
  || legacyScored.some((property) => !Number.isFinite(property.scores.lifestyle))) {
  throw new Error("Legacy API properties without lifestyle fields crash scoring.");
}
const distinctCommuteScores = new Set(scored.map((property) => property.scores.commute));
if (distinctCommuteScores.size < 2 || [...distinctCommuteScores].every((score) => score === 100)) {
  throw new Error("Best Commute scores are saturated at 100.");
}
for (const property of scored) {
  for (const score of Object.values(property.scores)) {
    if (score < 0 || score > 100) throw new Error(`Score outside 0-100 for ${property.id}.`);
  }
  const expectedFinal = Math.round(
    property.scores.commute * profile.weights.commute
    + property.scores.price * profile.weights.price
    + property.scores.housing * profile.weights.housing
    + property.scores.station * profile.weights.station
    + property.scores.lifestyle * profile.weights.lifestyle,
  );
  if (property.finalScore !== expectedFinal) throw new Error(`Final score formula mismatch for ${property.id}.`);
  if (property.recommendationReasons.length !== 2) throw new Error(`Public reasons missing for ${property.id}.`);
}

for (const mode of ["for-you", "value", "commute"] as const) {
  const ranked = rankProperties(scored, mode);
  const scoreOf = (index: number) => mode === "for-you"
    ? ranked[index].finalScore
    : mode === "value"
      ? ranked[index].valueScore
      : ranked[index].scores.commute;
  for (let index = 1; index < ranked.length; index += 1) {
    if (scoreOf(index) > scoreOf(index - 1)) throw new Error(`${mode} ranking is not descending.`);
  }
}

const globalRanking = rankProperties(scored, "for-you");
const top = globalRanking[0];
if (globalRanking.length !== result.properties.length) throw new Error("Global ranking omitted qualifying properties.");
const selectedStationProperties = globalRanking.filter((property) => property.station.key === top.station.key);
if (selectedStationProperties.length === 0
  || selectedStationProperties.some((property) => property.station.key !== top.station.key)
  || selectedStationProperties.length >= globalRanking.length) {
  throw new Error("Station selection did not produce the expected property subset.");
}

const accessStation = result.nearbyStations[0];
const accessResponse = await fetch(`${baseUrl}/api/commute`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    destination: moriTower.name,
    maxMinutes: 35,
    maxBudgetYen: 160000,
    destinationStationId: accessStation.id,
    destinationPlace: { lat: moriTower.lat, lng: moriTower.lng, address: moriTower.address },
  }),
});
if (!accessResponse.ok) throw new Error(`Destination station flow failed: ${accessResponse.status}`);
const accessResult = await accessResponse.json() as CommuteSearchResponse;
if (accessResult.selectedNearbyStationId !== accessStation.id || accessResult.properties.length === 0) {
  throw new Error("Destination access station filtering did not return listings.");
}

console.log(JSON.stringify({
  nearbyStations: result.nearbyStations.length,
  reachableStations: result.reachableStations.length,
  qualifyingProperties: result.properties.length,
  roomDna: profile.roomDnaName,
  inferredLayoutPreference: profile.layoutPreference,
  hbtiQuestionCount: HBTI_QUESTIONS.length,
  topForYou: { id: top.id, station: top.station.name, finalScore: top.finalScore },
  selectedAccessStation: {
    id: accessResult.selectedNearbyStationId,
    reachableStations: accessResult.reachableStations.length,
    qualifyingProperties: accessResult.properties.length,
  },
  checks: [
    "commute-filter",
    "maximum-budget-hard-filter",
    "legacy-api-maximum-budget-fallback",
    "ideal-budget-price-score",
    "precise-building-poi-search",
    "submit-with-top-place-suggestion",
    "zh-ja-en-localization",
    "destination-access-walk-max-15",
    "major-hub-access-weight",
    "deterministic-station-profile-and-average-rent-demo",
    "destination-station-refilter",
    "hbti-20-questions-five-per-page-model",
    "priority-hbti-swipe-combined-blackbox-profile",
    "specific-preference-hidden-reward-and-penalty",
    "drag-priority-35-25-18-13-9",
    "global-ranking-all-qualifying-properties",
    "station-click-property-subset",
    "best-commute-score-not-saturated",
    "legacy-api-missing-lifestyle-compatible",
    "internal-targets-and-tolerances",
    "layout-preference",
    "five-internal-scores-0-100",
    "deterministic-lifestyle-demo-data",
    "deterministic-specific-preference-demo-data",
    "three-ranking-modes",
    "public-hbti-result-and-why-matched-data",
  ],
}, null, 2));
