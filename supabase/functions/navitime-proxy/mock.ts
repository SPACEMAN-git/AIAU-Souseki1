// RAPIDAPI_KEY なしでも動作確認できる mock レスポンス
import type { NormalizedGeocode, NormalizedReachable } from "./navitime.ts";

export function mockGeocode(query: string): NormalizedGeocode {
  return {
    query,
    results: [
      { name: `${query}（mock: 東京駅付近）`, lat: 35.681236, lng: 139.767125 },
    ],
  };
}

const MOCK_STATIONS = [
  {
    id: "00006668",
    name: "渋谷",
    lat: 35.658,
    lng: 139.7016,
    timeMinutes: 12,
    transfers: 0,
  },
  {
    id: "00004155",
    name: "新宿",
    lat: 35.6896,
    lng: 139.7006,
    timeMinutes: 15,
    transfers: 0,
  },
  {
    id: "00003341",
    name: "池袋",
    lat: 35.7295,
    lng: 139.7109,
    timeMinutes: 21,
    transfers: 1,
  },
  {
    id: "00001421",
    name: "中野",
    lat: 35.7056,
    lng: 139.6659,
    timeMinutes: 24,
    transfers: 1,
  },
  {
    id: "00007813",
    name: "三軒茶屋",
    lat: 35.6432,
    lng: 139.6692,
    timeMinutes: 27,
    transfers: 1,
  },
  {
    id: "00002216",
    name: "北千住",
    lat: 35.7497,
    lng: 139.8049,
    timeMinutes: 33,
    transfers: 2,
  },
  {
    id: "00005012",
    name: "吉祥寺",
    lat: 35.7031,
    lng: 139.5797,
    timeMinutes: 38,
    transfers: 1,
  },
  {
    id: "00008852",
    name: "武蔵小杉",
    lat: 35.5766,
    lng: 139.6597,
    timeMinutes: 44,
    transfers: 2,
  },
];

export function mockReachable(
  origin: { lat: number; lng: number },
  term: number,
  transitLimit: number | null = null,
): NormalizedReachable {
  return {
    origin,
    term,
    transitLimit,
    stations: MOCK_STATIONS.filter((s) =>
      s.timeMinutes <= term &&
      (transitLimit === null || s.transfers <= transitLimit)
    ),
  };
}
