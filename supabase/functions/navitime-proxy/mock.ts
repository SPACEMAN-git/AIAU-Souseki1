// RAPIDAPI_KEY なしでも動作確認できる mock レスポンス
import type {
  NormalizedAccessStations,
  NormalizedGeocode,
  NormalizedRailwayGeometry,
  NormalizedReachable,
  NormalizedReachableArea,
  NormalizedReverseGeocode,
  NormalizedRoute,
  NormalizedStationLines,
  NormalizedTransport,
  NormalizedTransportCompany,
  ReachableAreaMode,
  TransportNode,
} from "./navitime.ts";

export function mockGeocode(query: string): NormalizedGeocode {
  return {
    query,
    source: "address",
    results: [
      { name: `${query}（mock: 東京駅付近）`, lat: 35.681236, lng: 139.767125 },
    ],
  };
}

export function mockReverseGeocode(
  coord: { lat: number; lng: number },
): NormalizedReverseGeocode {
  return {
    coord,
    results: [
      {
        name: "東京都千代田区丸の内1丁目9（mock）",
        lat: coord.lat,
        lng: coord.lng,
      },
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

// mock の到達圏は起点を囲む正六角形（分速から半径を概算）。
export function mockReachableArea(
  origin: { lat: number; lng: number },
  term: number,
  mode: ReachableAreaMode,
  bicycleSpeed: number | null,
): NormalizedReachableArea {
  const kmPerMinute = mode === "bicycle" ? (bicycleSpeed ?? 15) / 60 : 0.08;
  const radiusDeg = (kmPerMinute * term) / 111;
  const boundary = Array.from({ length: 6 }, (_, i) => {
    const rad = (Math.PI / 3) * i;
    return {
      lat: Number((origin.lat + radiusDeg * Math.cos(rad)).toFixed(6)),
      lng: Number((origin.lng + radiusDeg * Math.sin(rad)).toFixed(6)),
    };
  });
  return { origin, term, mode, bicycleSpeed, boundary };
}

// mock の主要起点駅（勤務先から徒歩圈内の駅を徒歩分の短い順に返す）
const MOCK_ACCESS_STATIONS = [
  {
    id: "00006668",
    name: "東京",
    lat: 35.681041,
    lng: 139.767106,
    walkMinutes: 3,
    walkDistance: 240,
  },
  {
    id: "00001165",
    name: "大手町",
    lat: 35.684606,
    lng: 139.766246,
    walkMinutes: 8,
    walkDistance: 620,
  },
  {
    id: "00002325",
    name: "有楽町",
    lat: 35.675069,
    lng: 139.763328,
    walkMinutes: 12,
    walkDistance: 940,
  },
  {
    id: "00004512",
    name: "二重橋前",
    lat: 35.679848,
    lng: 139.762428,
    walkMinutes: 17,
    walkDistance: 1360,
  },
];

export function mockAccessStations(
  origin: { lat: number; lng: number },
  walkLimit: number,
  max: number,
): NormalizedAccessStations {
  return {
    origin,
    walkLimit,
    stations: MOCK_ACCESS_STATIONS
      .filter((s) => s.walkMinutes <= walkLimit)
      .slice(0, max),
  };
}

export function mockTransportCompany(id: string): NormalizedTransportCompany {
  return { id, company: { id, name: "ＪＲ東日本（mock）" } };
}

const MOCK_NODES: TransportNode[] = [
  {
    id: "00006668",
    name: "東京",
    ruby: "とうきょう",
    types: ["station"],
    address: "東京都千代田区丸の内",
    lat: 35.681041,
    lng: 139.767106,
  },
  {
    id: "00003544",
    name: "渋谷",
    ruby: "しぶや",
    types: ["station"],
    address: "東京都渋谷区渋谷",
    lat: 35.658424,
    lng: 139.701509,
  },
  {
    id: "00004155",
    name: "新宿",
    ruby: "しんじゅく",
    types: ["station"],
    address: "東京都新宿区新宿",
    lat: 35.690921,
    lng: 139.70025,
  },
];

export function mockTransport(query: string, limit = 10): NormalizedTransport {
  const matched = MOCK_NODES.filter((n) => n.name.includes(query));
  const nodes = (matched.length > 0 ? matched : MOCK_NODES).slice(0, limit);
  return { query, nodes };
}

export function mockRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  startTime: string,
): NormalizedRoute {
  const base = new Date(startTime);
  const toIso = (minutes: number) =>
    new Date(base.getTime() + minutes * 60_000).toISOString();
  return {
    origin,
    destination,
    startTime,
    routes: [
      {
        totalMinutes: 33,
        transfers: 0,
        walkDistance: 483,
        fare: 253,
        fromTime: toIso(0),
        toTime: toIso(33),
        moveTypes: ["local_train", "walk"],
        sections: [
          {
            type: "point",
            name: "start（mock）",
            nodeId: null,
            move: null,
            lineName: null,
            timeMinutes: null,
          },
          {
            type: "move",
            name: "",
            nodeId: null,
            move: "walk",
            lineName: "徒歩",
            timeMinutes: 5,
          },
          {
            type: "point",
            name: "東京",
            nodeId: "00006668",
            move: null,
            lineName: null,
            timeMinutes: null,
          },
          {
            type: "move",
            name: "",
            nodeId: null,
            move: "local_train",
            lineName: "ＪＲ山手線（mock）",
            timeMinutes: 24,
          },
          {
            type: "point",
            name: "渋谷",
            nodeId: "00003544",
            move: null,
            lineName: null,
            timeMinutes: null,
          },
          {
            type: "move",
            name: "",
            nodeId: null,
            move: "walk",
            lineName: "徒歩",
            timeMinutes: 2,
          },
          {
            type: "point",
            name: "goal（mock）",
            nodeId: null,
            move: null,
            lineName: null,
            timeMinutes: null,
          },
        ],
      },
      {
        totalMinutes: 41,
        transfers: 1,
        walkDistance: 620,
        fare: 199,
        fromTime: toIso(0),
        toTime: toIso(41),
        moveTypes: ["local_train", "walk"],
        sections: [],
      },
    ],
  };
}

const MOCK_LINES: Record<string, {
  lineId: string;
  lineName: string;
  operator: string;
  color: string;
}> = {
  "00000766": {
    lineId: "00000766",
    lineName: "東京メトロ丸ノ内線（mock）",
    operator: "東京地下鉄（メトロ）",
    color: "#F62E36",
  },
  "00000141": {
    lineId: "00000141",
    lineName: "ＪＲ山手線（mock）",
    operator: "ＪＲ東日本",
    color: "#80C241",
  },
  "00000771": {
    lineId: "00000771",
    lineName: "東京メトロ東西線（mock）",
    operator: "東京地下鉄（メトロ）",
    color: "#009BBF",
  },
};

export function mockStationLines(ids: string[]): NormalizedStationLines {
  const lineIds = Object.keys(MOCK_LINES);
  return {
    stations: ids.map((id, i) => ({
      stationId: id,
      stationName: `駅${i + 1}（mock）`,
      lines: lineIds
        .slice(i % lineIds.length)
        .concat(lineIds.slice(0, i % lineIds.length))
        .slice(0, 2)
        .map((lineId) => MOCK_LINES[lineId]),
    })),
  };
}

export function mockRailwayGeometry(lineId: string): NormalizedRailwayGeometry {
  const line = MOCK_LINES[lineId] ?? {
    lineId,
    lineName: `路線${lineId}（mock）`,
    operator: "mock 鉄道",
    color: "#4C6EF5",
  };
  return {
    ...line,
    geometry: {
      type: "MultiLineString",
      coordinates: [
        [
          [139.767106, 35.681041],
          [139.7639, 35.6727],
          [139.7621, 35.6712],
        ],
        [
          [139.7621, 35.6712],
          [139.758, 35.6702],
          [139.7537, 35.6754],
        ],
      ],
    },
    stationIds: ["00006668", "00001908", "00005079"],
    requestCount: 0,
  };
}
