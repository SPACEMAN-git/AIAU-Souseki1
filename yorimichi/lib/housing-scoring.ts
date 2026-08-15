import type { PropertyMatch, ReachableStation } from "./commute-types";

export type HousingPreferenceKey = "commute" | "price" | "housing" | "station" | "lifestyle";
export type HousingWeights = Record<HousingPreferenceKey, number>;
export type RankingMode = "for-you" | "value" | "commute";
export type FiveGridValue = -2 | -1 | 0 | 1 | 2;
export type FiveGridQuestionId =
  | "commute_lifestyle" | "station_room" | "price_quality" | "time_transfer" | "room_lifestyle"
  | "pay_for_station" | "pay_for_commute" | "accept_older" | "prefer_large_1r" | "prioritize_lifestyle";
export type FiveGridAnswers = Record<FiveGridQuestionId, FiveGridValue>;
export type HbtiQuestionId =
  | "q01" | "q02" | "q03" | "q04" | "q05"
  | "q06" | "q07" | "q08" | "q09" | "q10"
  | "q11" | "q12" | "q13" | "q14" | "q15"
  | "q16" | "q17" | "q18" | "q19" | "q20";
export type HbtiAnswers = Record<HbtiQuestionId, FiveGridValue>;
export type SwipeReaction = -1 | 0 | 1 | 2;
export type SwipeFeedback = { propertyId: string; reaction: SwipeReaction; reasons: string[] };

export type RecommendationReason = { tone: "strong" | "balanced"; text: string };
export type PreferenceProfile = {
  weights: HousingWeights;
  targets: {
    totalMonthlyCostYen: number;
    commuteMinutes: number;
    stationWalkMinutes: number;
    areaSqm: number;
    maxBuildingAgeYears: number;
  };
  tolerances: {
    monthlyCostYen: number;
    commuteMinutes: number;
    stationWalkMinutes: number;
    areaSqm: number;
    buildingAgeYears: number;
  };
  transferPenaltyMinutes: number;
  layoutPreference: string[];
  roomDnaName: string;
  roomDnaDescription: string;
};
export type HousingScores = Record<HousingPreferenceKey, number>;
export type ScoredProperty = PropertyMatch & {
  scores: HousingScores;
  finalScore: number;
  valueScore: number;
  transferCount: number;
  recommendationReasons: RecommendationReason[];
};

export const HOUSING_DNA_ITEMS: Array<{
  key: HousingPreferenceKey;
  label: string;
  shortLabel: string;
  icon: string;
}> = [
  { key: "commute", label: "通勤 Commute", shortLabel: "通勤", icon: "🚃" },
  { key: "price", label: "价格 Price", shortLabel: "价格", icon: "💰" },
  { key: "housing", label: "房屋质量 Housing", shortLabel: "房屋", icon: "🏠" },
  { key: "station", label: "车站便利 Station", shortLabel: "车站", icon: "🚉" },
  { key: "lifestyle", label: "周边生活 Lifestyle", shortLabel: "生活", icon: "🛒" },
];
export const DEFAULT_HOUSING_DNA_ORDER: HousingPreferenceKey[] = ["commute", "price", "housing", "lifestyle", "station"];

/**
 * Fixed, explainable HBTI scoring directions. A positive answer applies the
 * listed effects; negative answers apply the exact inverse. Negative effects
 * are intentional reverse/trade-off scoring, not random penalties.
 */
export const HBTI_QUESTIONS: Array<{
  id: HbtiQuestionId;
  effects: Partial<Record<HousingPreferenceKey, number>>;
}> = [
  { id: "q01", effects: { housing: 1.4, station: -1.0 } },
  { id: "q02", effects: { commute: 1.5, price: -1.0 } },
  { id: "q03", effects: { commute: 1.2 } },
  { id: "q04", effects: { price: 1.4, housing: -1.1 } },
  { id: "q05", effects: { lifestyle: 1.3, station: 0.7 } },
  { id: "q06", effects: { housing: 1.3, station: -1.0 } },
  { id: "q07", effects: { price: 1.3, commute: -0.9 } },
  { id: "q08", effects: { station: 1.4, price: -0.9 } },
  { id: "q09", effects: { housing: 1.4, price: -0.7 } },
  { id: "q10", effects: { lifestyle: 1.4, commute: -0.8 } },
  { id: "q11", effects: { commute: 1.4, housing: -0.8 } },
  { id: "q12", effects: { price: 1.2, housing: -1.0 } },
  { id: "q13", effects: { lifestyle: 1.3, price: -0.8 } },
  { id: "q14", effects: { commute: 1.1 } },
  { id: "q15", effects: { housing: 1.4, station: -0.9 } },
  { id: "q16", effects: { price: 1.2, lifestyle: -1.0 } },
  { id: "q17", effects: { housing: 1.1, station: -1.0 } },
  { id: "q18", effects: { lifestyle: 1.2, station: 0.8 } },
  { id: "q19", effects: { price: 1.3, housing: -0.7 } },
  { id: "q20", effects: { commute: 1.5, lifestyle: -0.5 } },
];

export const DEFAULT_HBTI_ANSWERS = Object.fromEntries(
  HBTI_QUESTIONS.map((question) => [question.id, 0]),
) as HbtiAnswers;

export const FIVE_GRID_QUESTIONS: Array<{
  id: FiveGridQuestionId;
  group: "tradeoff" | "attitude";
  question: string;
  left: string;
  right: string;
}> = [
  { id: "commute_lifestyle", group: "tradeoff", question: "如果每天通勤能少 15 分钟，我可以接受住得离常去的商圈和朋友远一点。", left: "更想缩短通勤", right: "更想靠近生活圈" },
  { id: "station_room", group: "tradeoff", question: "我喜欢大一点、更舒服的房间，就算每天去车站要多走几分钟也没关系。", left: "离车站近更重要", right: "房间大更重要" },
  { id: "price_quality", group: "tradeoff", question: "为了更新的房子和更好的基础条件，我愿意每月多付一些租金。", left: "控制月租更重要", right: "房屋品质更重要" },
  { id: "time_transfer", group: "tradeoff", question: "如果可以少换乘一次，我能接受总通勤时间多 5–10 分钟。", left: "总时间更短", right: "尽量不换乘" },
  { id: "room_lifestyle", group: "tradeoff", question: "如果楼下有更多超市、餐厅和便利店，我可以接受房间小一点。", left: "房间空间更重要", right: "周边生活更重要" },
  { id: "pay_for_station", group: "attitude", question: "如果从家到车站只要 3–5 分钟，我愿意每月多付约 5,000 日元。", left: "不太值得", right: "很值得" },
  { id: "pay_for_commute", group: "attitude", question: "如果每天往返能少 20 分钟，我愿意把更多预算花在房租上。", left: "不会增加预算", right: "愿意增加预算" },
  { id: "accept_older", group: "attitude", question: "只要交通和周边足够方便，築 20 年以上的房子我也可以认真考虑。", left: "很难接受", right: "完全可以" },
  { id: "prefer_large_1r", group: "attitude", question: "比起较小但分区明确的 1K，我会选择面积更大、租金更低的 1R。", left: "更喜欢 1K", right: "更喜欢大 1R" },
  { id: "prioritize_lifestyle", group: "attitude", question: "即使单程通勤多 10 分钟，我也想住在方便见朋友、逛街和吃饭的区域。", left: "通勤优先", right: "生活圈优先" },
];
export const DEFAULT_FIVE_GRID_ANSWERS = Object.fromEntries(
  FIVE_GRID_QUESTIONS.map((question) => [question.id, 0]),
) as FiveGridAnswers;

export const SWIPE_REASON_OPTIONS = {
  like: ["租金便宜", "通勤时间短", "离车站近", "房间更大", "房子更新", "去喜欢的地方方便", "不需要换乘"],
  dislike: ["租金太高", "通勤太久", "离车站太远", "房间太小", "房子太旧", "生活不方便", "换乘太多"],
} as const;

const RANK_WEIGHTS = [0.35, 0.25, 0.18, 0.13, 0.09] as const;
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const roundScore = (value: number) => Math.round(clamp(value));

function median(values: number[], fallback: number) {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentileSpread(values: number[], fallback: number) {
  if (values.length < 4) return fallback;
  const sorted = [...values].sort((left, right) => left - right);
  return Math.max(fallback, sorted[Math.floor(sorted.length * 0.75)] - sorted[Math.floor(sorted.length * 0.25)]);
}

function normalizeWeights(weights: HousingWeights) {
  const total = Object.values(weights).reduce((sum, weight) => sum + Math.max(0.03, weight), 0);
  for (const key of Object.keys(weights) as HousingPreferenceKey[]) {
    weights[key] = Math.max(0.03, weights[key]) / total;
  }
  return weights;
}

function adjustPair(weights: HousingWeights, value: FiveGridValue, left: HousingPreferenceKey, right: HousingPreferenceKey, strength = 0.022) {
  weights[left] -= value * strength;
  weights[right] += value * strength;
}

function reasonDimension(reason: string): HousingPreferenceKey {
  if (reason.includes("租金")) return "price";
  if (reason.includes("通勤") || reason.includes("换乘")) return "commute";
  if (reason.includes("车站")) return "station";
  if (reason.includes("房间") || reason.includes("房子")) return "housing";
  return "lifestyle";
}

function dnaNameFor(primary: HousingPreferenceKey, secondary: HousingPreferenceKey) {
  const names: Record<string, string> = {
    "commute:price": "🚃 精准通勤派", "commute:housing": "⚡ 舒适效率派",
    "commute:station": "🚉 零摩擦通勤派", "commute:lifestyle": "🌆 都市机动派",
    "housing:price": "💰 空间价值派", "price:station": "🧭 实用据点派",
    "lifestyle:price": "🍜 生活性价比派", "housing:station": "🏠 舒适近站派",
    "housing:lifestyle": "🌿 生活质感派", "lifestyle:station": "🛒 街区便利派",
  };
  return names[[primary, secondary].sort().join(":")] ?? "🧬 平衡探索派";
}

export function derivePreferenceProfile(
  order: HousingPreferenceKey[],
  answers: FiveGridAnswers,
  feedback: SwipeFeedback[],
  properties: PropertyMatch[],
): PreferenceProfile {
  const weights: HousingWeights = { commute: 0, price: 0, housing: 0, station: 0, lifestyle: 0 };
  order.forEach((key, index) => { weights[key] = RANK_WEIGHTS[index] ?? 0; });
  adjustPair(weights, answers.commute_lifestyle, "commute", "lifestyle");
  adjustPair(weights, answers.station_room, "station", "housing");
  adjustPair(weights, answers.price_quality, "price", "housing");
  adjustPair(weights, answers.room_lifestyle, "housing", "lifestyle");
  adjustPair(weights, answers.pay_for_station, "price", "station", 0.016);
  adjustPair(weights, answers.pay_for_commute, "price", "commute", 0.018);
  adjustPair(weights, answers.accept_older, "housing", "station", 0.012);
  adjustPair(weights, answers.prioritize_lifestyle, "commute", "lifestyle", 0.018);
  if (answers.prefer_large_1r > 0) {
    weights.housing += answers.prefer_large_1r * 0.012;
    weights.price += answers.prefer_large_1r * 0.008;
  }
  for (const response of feedback) {
    const intensity = Math.max(1, Math.abs(response.reaction));
    for (const reason of response.reasons) weights[reasonDimension(reason)] += 0.01 * intensity;
  }
  normalizeWeights(weights);

  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const likedProperties = feedback.filter((response) => response.reaction > 0).flatMap((response) => {
    const property = propertyById.get(response.propertyId);
    return property ? [property] : [];
  });
  const calibrationSet = likedProperties.length > 0 ? likedProperties : properties;
  const allCosts = properties.map((property) => property.monthlyRentYen + property.managementFeeYen);
  const allCommutes = properties.map((property) => property.commute.finalMinutes);
  const allWalks = properties.map((property) => property.station.walkingMinutes);
  const allAreas = properties.map((property) => property.areaSqm);
  const allAges = properties.map((property) => property.buildingAgeYears);
  let targetCost = median(calibrationSet.map((property) => property.monthlyRentYen + property.managementFeeYen), 90000);
  let targetCommute = median(calibrationSet.map((property) => property.commute.finalMinutes), 35);
  let targetWalk = median(calibrationSet.map((property) => property.station.walkingMinutes), 7);
  let targetArea = median(calibrationSet.map((property) => property.areaSqm), 24);
  let maxAge = median(calibrationSet.map((property) => property.buildingAgeYears), 15);
  for (const response of feedback) {
    if (response.reasons.includes("租金太高")) targetCost -= 3000;
    if (response.reasons.includes("通勤太久")) targetCommute -= 2;
    if (response.reasons.includes("离车站太远")) targetWalk -= 1;
    if (response.reasons.includes("房间太小")) targetArea += 1.5;
    if (response.reasons.includes("房子太旧")) maxAge -= 2;
  }

  const layoutScores = new Map<string, number>([["1R", 0], ["1K", 0], ["1DK", 0]]);
  for (const response of feedback) {
    const property = propertyById.get(response.propertyId);
    if (property) layoutScores.set(property.layout, (layoutScores.get(property.layout) ?? 0) + response.reaction);
  }
  layoutScores.set("1R", (layoutScores.get("1R") ?? 0) + answers.prefer_large_1r * 0.8);
  layoutScores.set("1K", (layoutScores.get("1K") ?? 0) - answers.prefer_large_1r * 0.3);
  const layoutPreference = [...layoutScores.entries()].sort((left, right) => right[1] - left[1]).map(([layout]) => layout);
  const priority = (Object.keys(weights) as HousingPreferenceKey[]).sort((left, right) => weights[right] - weights[left]);
  const primaryLabel = HOUSING_DNA_ITEMS.find((item) => item.key === priority[0])!.shortLabel;
  const secondaryLabel = HOUSING_DNA_ITEMS.find((item) => item.key === priority[1])!.shortLabel;
  const roomDnaName = dnaNameFor(priority[0], priority[1]);

  return {
    weights,
    targets: {
      totalMonthlyCostYen: clamp(targetCost, 45000, 250000), commuteMinutes: clamp(targetCommute, 10, 90),
      stationWalkMinutes: clamp(targetWalk, 1, 20), areaSqm: clamp(targetArea, 12, 80), maxBuildingAgeYears: clamp(maxAge, 0, 60),
    },
    tolerances: {
      monthlyCostYen: percentileSpread(allCosts, 12000), commuteMinutes: percentileSpread(allCommutes, 6),
      stationWalkMinutes: percentileSpread(allWalks, 3), areaSqm: percentileSpread(allAreas, 4),
      buildingAgeYears: percentileSpread(allAges, 8),
    },
    transferPenaltyMinutes: 4 + (answers.time_transfer + 2) * 2,
    layoutPreference,
    roomDnaName,
    roomDnaDescription: `你会优先寻找${primaryLabel}表现稳定、同时兼顾${secondaryLabel}的房源，偏好 ${layoutPreference[0]}，并愿意在次要条件上做适度取舍。`,
  };
}

function hbtiTypeName(weights: HousingWeights) {
  const primary = (Object.keys(weights) as HousingPreferenceKey[])
    .sort((left, right) => weights[right] - weights[left])[0];
  const names: Record<HousingPreferenceKey, string> = {
    commute: "🚃 Time Saver",
    price: "💰 Smart Saver",
    housing: "🏠 Comfort Seeker",
    station: "🚉 Easy Access",
    lifestyle: "🌆 City Connector",
  };
  return names[primary];
}

export function deriveHbtiProfile(
  answers: HbtiAnswers,
  properties: PropertyMatch[],
  order: HousingPreferenceKey[] = DEFAULT_HOUSING_DNA_ORDER,
  feedback: SwipeFeedback[] = [],
): PreferenceProfile {
  const baseProfile = derivePreferenceProfile(
    order,
    { ...DEFAULT_FIVE_GRID_ANSWERS },
    feedback,
    properties,
  );
  const weights: HousingWeights = { commute: 0, price: 0, housing: 0, station: 0, lifestyle: 0 };
  order.forEach((key, index) => {
    weights[key] = (RANK_WEIGHTS[index] ?? RANK_WEIGHTS[RANK_WEIGHTS.length - 1]) * 60;
  });

  for (const question of HBTI_QUESTIONS) {
    const answer = answers[question.id] ?? 0;
    for (const [key, effect] of Object.entries(question.effects)) {
      weights[key as HousingPreferenceKey] += answer * effect;
    }
  }
  const swipeEffects: Record<string, Partial<Record<HousingPreferenceKey, number>>> = {
    "dna-compact-near-station": { commute: 1.4, station: 1.4, price: -0.8, housing: -0.5 },
    "dna-large-value-room": { price: 1.3, housing: 1.2, station: -0.9, commute: -0.5 },
    "dna-new-lifestyle-home": { housing: 1.2, lifestyle: 1.4, price: -0.9, commute: -0.5 },
  };
  for (const response of feedback) {
    for (const [key, effect] of Object.entries(swipeEffects[response.propertyId] ?? {})) {
      weights[key as HousingPreferenceKey] += response.reaction * effect;
    }
  }
  normalizeWeights(weights);

  const spacePreference = answers.q01 + answers.q06 + answers.q15 + answers.q17;
  const economicalLayout = answers.q04 + answers.q12 + answers.q19;
  const layoutPreference = spacePreference >= 2
    ? ["1DK", "1R", "1K"]
    : economicalLayout >= 2
      ? ["1R", "1K", "1DK"]
      : ["1K", "1R", "1DK"];
  const transferPreference = (answers.q03 + answers.q14) / 2;
  const typeName = hbtiTypeName(weights);

  return {
    ...baseProfile,
    weights,
    layoutPreference,
    transferPenaltyMinutes: clamp(6 + transferPreference * 2, 2, 10),
    roomDnaName: typeName,
    roomDnaDescription: "Your answers create a deterministic five-dimension housing preference profile.",
  };
}

export function applyHbtiPriorityOrder(
  profile: PreferenceProfile,
  order: HousingPreferenceKey[],
): PreferenceProfile {
  const weights = { ...profile.weights };
  order.forEach((key, index) => {
    weights[key] = RANK_WEIGHTS[index] ?? RANK_WEIGHTS[RANK_WEIGHTS.length - 1];
  });
  return { ...profile, weights };
}

function lowerTargetScore(value: number, target: number, tolerance: number) {
  if (value <= target) return roundScore(88 + Math.min(1, (target - value) / tolerance) * 12);
  return roundScore(88 - Math.min(2, (value - target) / tolerance) * 35);
}
function higherTargetScore(value: number, target: number, tolerance: number) {
  if (value >= target) return roundScore(88 + Math.min(1, (value - target) / tolerance) * 12);
  return roundScore(88 - Math.min(2, (target - value) / tolerance) * 35);
}
function lifestyleScore(property: PropertyMatch) {
  const walk = property.lifestyle?.nearestSupermarketWalkMinutes ?? 10;
  const supermarkets = property.lifestyle?.supermarketsWithin10Minutes ?? 1;
  const convenience = property.lifestyle?.convenienceStoresWithin10Minutes ?? 2;
  const restaurants = property.lifestyle?.restaurantsWithin10Minutes ?? 4;
  return roundScore(
    clamp(100 - Math.max(0, walk - 2) * 5.5, 35, 100) * 0.35
    + clamp(52 + supermarkets * 6, 45, 100) * 0.25
    + clamp(50 + convenience * 3.5, 45, 100) * 0.2
    + clamp(48 + restaurants * 1.4, 45, 100) * 0.2,
  );
}
function reasonFor(key: HousingPreferenceKey, score: number, property: PropertyMatch): RecommendationReason {
  const strong = score >= 80;
  const lifestyleIsDemo = property.lifestyle?.dataSource !== "real_poi";
  const messages: Record<HousingPreferenceKey, [string, string]> = {
    commute: ["通勤优秀", "通勤符合预算"], price: ["性价比高", "总月费可接受"],
    housing: ["房屋条件匹配", "房屋条件较均衡"], station: ["离车站近", "到站距离可接受"],
    lifestyle: [lifestyleIsDemo ? "生活便利 Demo 表现好" : "生活设施丰富", lifestyleIsDemo ? "生活数据为 Demo" : "生活便利度适中"],
  };
  return { tone: strong ? "strong" : "balanced", text: strong ? messages[key][0] : messages[key][1] };
}

export function scoreProperties(properties: PropertyMatch[], stations: ReachableStation[], profile: PreferenceProfile): ScoredProperty[] {
  const stationByKey = new Map(stations.map((station) => [station.id, station]));
  return properties.map((property) => {
    const transferCount = stationByKey.get(property.station.key)?.transfers ?? 0;
    const totalCost = property.monthlyRentYen + property.managementFeeYen;
    const effectiveCommute = property.commute.finalMinutes + transferCount * profile.transferPenaltyMinutes;
    const layoutRank = profile.layoutPreference.indexOf(property.layout);
    const layoutScore = layoutRank === 0 ? 100 : layoutRank === 1 ? 82 : 68;
    const areaScore = higherTargetScore(property.areaSqm, profile.targets.areaSqm, profile.tolerances.areaSqm);
    const ageScore = lowerTargetScore(property.buildingAgeYears, profile.targets.maxBuildingAgeYears, profile.tolerances.buildingAgeYears);
    const targetCommuteScore = lowerTargetScore(effectiveCommute, profile.targets.commuteMinutes, profile.tolerances.commuteMinutes);
    const continuousCommuteScore = clamp(110 - effectiveCommute * 0.65);
    const scores: HousingScores = {
      commute: roundScore(targetCommuteScore * 0.55 + continuousCommuteScore * 0.45),
      price: lowerTargetScore(totalCost, profile.targets.totalMonthlyCostYen, profile.tolerances.monthlyCostYen),
      housing: roundScore(areaScore * 0.5 + ageScore * 0.35 + layoutScore * 0.15),
      station: lowerTargetScore(property.station.walkingMinutes, profile.targets.stationWalkMinutes, profile.tolerances.stationWalkMinutes),
      lifestyle: lifestyleScore(property),
    };
    const finalScore = roundScore(Object.entries(scores).reduce(
      (sum, [key, score]) => sum + score * profile.weights[key as HousingPreferenceKey], 0,
    ));
    const valueScore = roundScore(scores.price * 0.4 + scores.housing * 0.3 + scores.commute * 0.15 + scores.station * 0.1 + scores.lifestyle * 0.05);
    const recommendationReasons = (Object.keys(profile.weights) as HousingPreferenceKey[])
      .sort((left, right) => profile.weights[right] - profile.weights[left]).slice(0, 2)
      .map((key) => reasonFor(key, scores[key], property));
    return { ...property, scores, finalScore, valueScore, transferCount, recommendationReasons };
  });
}

export function rankProperties(properties: ScoredProperty[], mode: RankingMode) {
  return [...properties].sort((left, right) => {
    if (mode === "value") return right.valueScore - left.valueScore || right.finalScore - left.finalScore || left.monthlyRentYen - right.monthlyRentYen;
    if (mode === "commute") return right.scores.commute - left.scores.commute || left.commute.finalMinutes - right.commute.finalMinutes || left.transferCount - right.transferCount;
    return right.finalScore - left.finalScore || right.valueScore - left.valueScore || left.commute.finalMinutes - right.commute.finalMinutes;
  });
}
