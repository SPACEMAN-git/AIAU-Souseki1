import { assertEquals } from "jsr:@std/assert@1";
import {
  geocodeFromTransport,
  haversineMeters,
  nearestStationCandidates,
  normalizeGeocode,
  normalizeReachable,
  normalizeReachableArea,
  normalizeReverseGeocode,
  normalizeRoute,
  normalizeStationLines,
  normalizeTransport,
  normalizeTransportCompany,
  viaIndexes,
} from "./navitime.ts";
import {
  mockAccessStations,
  mockGeocode,
  mockReachable,
  mockRoute,
  mockTransport,
} from "./mock.ts";
import { handleRequest } from "./index.ts";

Deno.test("normalizeGeocode: NAVITIME items -> results", () => {
  const raw = {
    items: [
      { name: "東京都渋谷区", coord: { lat: 35.66, lon: 139.7 } },
      { name: "coord なしは除外される" },
    ],
  };
  const n = normalizeGeocode("渋谷", raw);
  assertEquals(n.query, "渋谷");
  assertEquals(n.source, "address");
  assertEquals(n.results, [{ name: "東京都渋谷区", lat: 35.66, lng: 139.7 }]);
});

Deno.test("normalizeReverseGeocode: coord -> 住所結果", () => {
  const coord = { lat: 35.624822, lng: 139.742121 };
  const n = normalizeReverseGeocode(coord, {
    items: [
      {
        name: "東京都品川区北品川1丁目6-16",
        coord: { lat: 35.624706, lon: 139.740515 },
      },
    ],
  });
  assertEquals(n.coord, coord);
  assertEquals(n.results[0].name, "東京都品川区北品川1丁目6-16");
  assertEquals(n.results[0].lng, 139.740515);
});

Deno.test("geocodeFromTransport: 駅名検索結果を geocode 形式に変換", () => {
  const n = geocodeFromTransport(mockTransport("東京", 1));
  assertEquals(n.source, "transport_node");
  assertEquals(n.results[0].name, "東京（東京都千代田区丸の内）");
  assertEquals(n.results[0].lat, 35.681041);
});

Deno.test("handler: reverse_geocode (mock=1) / lat不正は 400", async () => {
  const ok = await handleRequest(
    new Request(
      "http://local/x?action=reverse_geocode&lat=35.62&lng=139.74&mock=1",
    ),
  );
  assertEquals(ok.status, 200);
  const body = await ok.json();
  assertEquals(body.ok, true);
  assertEquals(body.data.coord, { lat: 35.62, lng: 139.74 });
  assertEquals(body.data.results.length, 1);

  const bad = await handleRequest(
    new Request("http://local/x?action=reverse_geocode&lat=abc&mock=1"),
  );
  assertEquals(bad.status, 400);
});

Deno.test("normalizeReachableArea: coord 列 -> boundary", () => {
  const n = normalizeReachableArea(
    { lat: 35.665251, lng: 139.712092 },
    30,
    "bicycle",
    15,
    {
      items: [
        { coord: { lat: 35.623079, lon: 139.706072 } },
        { coord: { lat: 35.625683, lon: 139.691452 } },
        { name: "coord なしは除外される" },
      ],
    },
  );
  assertEquals(n.mode, "bicycle");
  assertEquals(n.bicycleSpeed, 15);
  assertEquals(n.boundary, [
    { lat: 35.623079, lng: 139.706072 },
    { lat: 35.625683, lng: 139.691452 },
  ]);
});

Deno.test("normalizeTransportCompany: items -> company（0 件は null）", () => {
  const found = normalizeTransportCompany("00000004", {
    items: [{ id: "00000004", name: "ＪＲ東日本" }],
  });
  assertEquals(found.company, { id: "00000004", name: "ＪＲ東日本" });
  assertEquals(normalizeTransportCompany("99999999", {}).company, null);
});

Deno.test("handler: reachable_area (mock=1) / mode 不正は 400", async () => {
  const ok = await handleRequest(
    new Request(
      "http://local/x?action=reachable_area&lat=35.665&lng=139.712&term=30&mode=bicycle&bicycle_speed=15&mock=1",
    ),
  );
  const body = await ok.json();
  assertEquals(ok.status, 200);
  assertEquals(body.data.mode, "bicycle");
  assertEquals(body.data.bicycleSpeed, 15);
  assertEquals(body.data.boundary.length, 6);

  const walk = await handleRequest(
    new Request(
      "http://local/x?action=reachable_area&lat=35.665&lng=139.712&term=15&mode=walk&mock=1",
    ),
  );
  const walkBody = await walk.json();
  assertEquals(walkBody.data.mode, "walk");
  assertEquals(walkBody.data.bicycleSpeed, null);

  const bad = await handleRequest(
    new Request(
      "http://local/x?action=reachable_area&lat=35.665&lng=139.712&term=30&mode=car&mock=1",
    ),
  );
  assertEquals(bad.status, 400);
});

Deno.test("handler: transport_company (mock=1) / id 無しは 400", async () => {
  const ok = await handleRequest(
    new Request("http://local/x?action=transport_company&id=00000004&mock=1"),
  );
  const body = await ok.json();
  assertEquals(ok.status, 200);
  assertEquals(body.data.company.id, "00000004");

  const bad = await handleRequest(
    new Request("http://local/x?action=transport_company&mock=1"),
  );
  assertEquals(bad.status, 400);
});

Deno.test("normalizeReachable: time 昇順ソート & time 欠損は term で補完", () => {
  const origin = { lat: 35.68, lng: 139.76 };
  const raw = {
    items: [
      { node_id: "b", name: "B駅", coord: { lat: 35.7, lon: 139.8 }, time: 30 },
      {
        node_id: "a",
        name: "A駅",
        coord: { lat: 35.69, lon: 139.75 },
        time: 10,
      },
      { node_id: "c", name: "C駅", coord: { lat: 35.71, lon: 139.72 } },
    ],
  };
  const n = normalizeReachable(origin, 45, null, raw);
  assertEquals(n.stations.map((s) => s.id), ["a", "b", "c"]);
  assertEquals(n.stations[2].timeMinutes, 45);
});

Deno.test("normalizeReachable: transit_count -> transfers（欠損は 0）", () => {
  const raw = {
    items: [
      {
        node_id: "a",
        name: "A駅",
        coord: { lat: 35.69, lon: 139.75 },
        time: 10,
        transit_count: 2,
      },
      { node_id: "b", name: "B駅", coord: { lat: 35.7, lon: 139.8 }, time: 30 },
    ],
  };
  const n = normalizeReachable({ lat: 35.68, lng: 139.76 }, 45, 3, raw);
  assertEquals(n.transitLimit, 3);
  assertEquals(n.stations[0].transfers, 2);
  assertEquals(n.stations[1].transfers, 0);
});

Deno.test("mock: reachable は term / transit_limit で絞り込まれる", () => {
  const all = mockReachable({ lat: 35.68, lng: 139.76 }, 180);
  const few = mockReachable({ lat: 35.68, lng: 139.76 }, 20);
  const direct = mockReachable({ lat: 35.68, lng: 139.76 }, 180, 0);
  assertEquals(all.stations.length, 8);
  assertEquals(few.stations.map((s) => s.name), ["渋谷", "新宿"]);
  assertEquals(direct.stations.every((s) => s.transfers === 0), true);
  assertEquals(mockGeocode("新宿").results.length, 1);
});

Deno.test("handler: geocode (mock=1) は normalized 形式を返す", async () => {
  const res = await handleRequest(
    new Request("http://local/navitime-proxy?action=geocode&q=東京駅&mock=1"),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.mock, true);
  assertEquals(typeof body.data.results[0].lat, "number");
});

Deno.test("handler: パラメータ不正は 400", async () => {
  const cases = [
    "http://local/x?action=geocode",
    "http://local/x?action=reachable&lat=abc&lng=139&term=30",
    "http://local/x?action=reachable&lat=35.6&lng=139.7&term=999",
    "http://local/x?action=reachable&lat=35.6&lng=139.7&term=30&transit_limit=99",
    "http://local/x?action=reachable&lat=35.6&lng=139.7&term=30&transit_limit=1.5",
    "http://local/x?action=transport",
    "http://local/x?action=transport&q=渋谷&limit=0",
    "http://local/x?action=transport&q=渋谷&limit=31",
    "http://local/x?action=route&from_lat=abc&from_lng=139.767&to_lat=35.658&to_lng=139.701",
    "http://local/x?action=route&from_lat=35.681&from_lng=139.767&to_lat=35.658&to_lng=139.701&start_time=tomorrow",
    "http://local/x?action=unknown",
  ];
  for (const u of cases) {
    const res = await handleRequest(new Request(u));
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.ok, false);
  }
});

Deno.test("handler: reachable (mock=1) は term 以内の駅のみ返す", async () => {
  const res = await handleRequest(
    new Request(
      "http://local/x?action=reachable&lat=35.681&lng=139.767&term=25&mock=1",
    ),
  );
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(
    body.data.stations.every((s: { timeMinutes: number }) =>
      s.timeMinutes <= 25
    ),
    true,
  );
});

Deno.test("normalizeTransport: transport_node items -> nodes", () => {
  const raw = {
    items: [
      {
        id: "00003544",
        name: "渋谷",
        ruby: "しぶや",
        types: ["station"],
        address_name: "東京都渋谷区渋谷",
        coord: { lat: 35.658424, lon: 139.701509 },
      },
      { id: "00000000", name: "coord なしは除外される" },
    ],
  };
  const n = normalizeTransport("渋谷", raw);
  assertEquals(n.nodes.length, 1);
  assertEquals(n.nodes[0], {
    id: "00003544",
    name: "渋谷",
    ruby: "しぶや",
    types: ["station"],
    address: "東京都渋谷区渋谷",
    lat: 35.658424,
    lng: 139.701509,
  });
});

Deno.test("normalizeRoute: summary/sections -> routes（IC 運賃優先・所要時間昇順）", () => {
  const origin = { lat: 35.681, lng: 139.767 };
  const destination = { lat: 35.658, lng: 139.701 };
  const raw = {
    items: [
      {
        summary: {
          move: {
            time: 41,
            transit_count: 1,
            walk_distance: 620,
            from_time: "2026-08-17T09:00:00+09:00",
            to_time: "2026-08-17T09:41:00+09:00",
            move_type: ["local_train", "walk"],
            fare: { unit_0: 210 },
          },
        },
        sections: [],
      },
      {
        summary: {
          move: {
            time: 33,
            transit_count: 0,
            walk_distance: 483,
            from_time: "2026-08-17T09:00:00+09:00",
            to_time: "2026-08-17T09:33:00+09:00",
            move_type: ["local_train", "walk"],
            fare: { unit_0: 260, unit_48: 253 },
          },
        },
        sections: [
          { type: "point", name: "start" },
          {
            type: "move",
            move: "local_train",
            line_name: "ＪＲ山手線",
            time: 24,
          },
          { type: "point", name: "渋谷", node_id: "00003544" },
        ],
      },
      { summary: { move: {} }, sections: [] },
    ],
  };
  const n = normalizeRoute(origin, destination, "2026-08-17T09:00:00", raw);
  assertEquals(n.routes.map((r) => r.totalMinutes), [33, 41]);
  assertEquals(n.routes[0].fare, 253);
  assertEquals(n.routes[1].fare, 210);
  assertEquals(n.routes[0].sections[1].lineName, "ＪＲ山手線");
  assertEquals(n.routes[0].sections[2].nodeId, "00003544");
});

Deno.test("mock: transport / route", () => {
  assertEquals(mockTransport("渋谷").nodes.map((n) => n.name), ["渋谷"]);
  assertEquals(mockTransport("存在しない", 2).nodes.length, 2);
  const r = mockRoute(
    { lat: 35.681, lng: 139.767 },
    { lat: 35.658, lng: 139.701 },
    "2026-08-17T09:00:00+09:00",
  );
  assertEquals(r.routes.length, 2);
  assertEquals(r.routes[0].transfers, 0);
});

Deno.test("handler: transport (mock=1) は normalized 形式を返す", async () => {
  const res = await handleRequest(
    new Request("http://local/x?action=transport&q=渋谷&limit=5&mock=1"),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.mock, true);
  assertEquals(body.data.nodes[0].name, "渋谷");
});

Deno.test("handler: route (mock=1) は start_time 省略時も 200", async () => {
  const res = await handleRequest(
    new Request(
      "http://local/x?action=route&from_lat=35.681&from_lng=139.767&to_lat=35.658&to_lng=139.701&mock=1",
    ),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.data.routes.length > 0, true);
  assertEquals(typeof body.data.routes[0].totalMinutes, "number");
});

Deno.test("handler: reachable (mock=1) は transit_limit でも絞り込む", async () => {
  const res = await handleRequest(
    new Request(
      "http://local/x?action=reachable&lat=35.681&lng=139.767&term=180&transit_limit=1&mock=1",
    ),
  );
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.data.transitLimit, 1);
  assertEquals(
    body.data.stations.every((s: { transfers: number }) => s.transfers <= 1),
    true,
  );
});

Deno.test("haversineMeters: 東京駅〜大手町駅は約 400m", () => {
  const d = haversineMeters(
    { lat: 35.681236, lng: 139.767125 },
    { lat: 35.684606, lng: 139.766246 },
  );
  assertEquals(d > 300 && d < 500, true);
});

Deno.test("nearestStationCandidates: 徒歩上限相当の直線距離で絞り近い順に返す", () => {
  const origin = { lat: 35.681236, lng: 139.767125 };
  const stations = [
    {
      id: "far",
      name: "遠い駅",
      lat: 35.7295,
      lng: 139.7109,
      timeMinutes: 21,
      transfers: 1,
    },
    {
      id: "mid",
      name: "中間駅",
      lat: 35.675069,
      lng: 139.763328,
      timeMinutes: 4,
      transfers: 0,
    },
    {
      id: "near",
      name: "近い駅",
      lat: 35.684606,
      lng: 139.766246,
      timeMinutes: 2,
      transfers: 0,
    },
  ];
  const picked = nearestStationCandidates(origin, stations, 15, 5);
  assertEquals(picked.map((s) => s.id), ["near", "mid"]);
  assertEquals(nearestStationCandidates(origin, stations, 15, 1).length, 1);
});

Deno.test("mockAccessStations: walk_limit と max を反映する", () => {
  const origin = { lat: 35.681236, lng: 139.767125 };
  const all = mockAccessStations(origin, 15, 3);
  assertEquals(all.stations.map((s) => s.walkMinutes), [3, 8, 12]);
  assertEquals(mockAccessStations(origin, 5, 3).stations.length, 1);
  assertEquals(mockAccessStations(origin, 60, 2).stations.length, 2);
});

Deno.test("handler: access_stations (mock=1) は徒歩時間昇順で最大 max 件", async () => {
  const res = await handleRequest(
    new Request(
      "http://local/x?action=access_stations&lat=35.681236&lng=139.767125&walk_limit=15&max=2&mock=1",
    ),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.data.walkLimit, 15);
  assertEquals(
    body.data.stations.map((s: { walkMinutes: number }) => s.walkMinutes),
    [3, 8],
  );
});

Deno.test("handler: access_stations は不正な walk_limit を 400 にする", async () => {
  const res = await handleRequest(
    new Request(
      "http://local/x?action=access_stations&lat=35.681236&lng=139.767125&walk_limit=0&mock=1",
    ),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error.code, "bad_request");
});

Deno.test("normalizeStationLines: details から路線を重複排除して取り出す", () => {
  const normalized = normalizeStationLines({
    items: [
      {
        id: "00006668",
        name: "東京",
        details: [
          {
            company: { id: "00000004", name: "ＪＲ東日本" },
            link: { id: "00000123", name: "ＪＲ横須賀線", color: "#007AC0" },
          },
          {
            company: { id: "00000004", name: "ＪＲ東日本" },
            link: { id: "00000123", name: "ＪＲ横須賀線", color: "#007AC0" },
          },
          {
            company: { id: "00000113", name: "東京地下鉄（メトロ）" },
            link: {
              id: "00000766",
              name: "東京メトロ丸ノ内線",
              color: "#F62E36",
            },
          },
          { company: { id: "00000004", name: "ＪＲ東日本" } },
        ],
      },
    ],
  });
  assertEquals(normalized.stations.length, 1);
  const station = normalized.stations[0];
  assertEquals(station.stationId, "00006668");
  assertEquals(station.lines.map((l) => l.lineId), ["00000123", "00000766"]);
  assertEquals(station.lines[1].operator, "東京地下鉄（メトロ）");
  assertEquals(station.lines[1].color, "#F62E36");
});

Deno.test("viaIndexes: 端点を含まない等間隔の経由地を返す", () => {
  assertEquals(viaIndexes(0, 24, 3), [6, 12, 18]);
  assertEquals(viaIndexes(0, 1, 3), []);
  assertEquals(viaIndexes(0, 2, 1), [1]);
});

Deno.test("handler: station_lines (mock=1) は駅ごとの路線を返す", async () => {
  const res = await handleRequest(
    new Request(
      "http://local/x?action=station_lines&ids=00006668,00001878&mock=1",
    ),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.data.stations.length, 2);
  assertEquals(body.data.stations[0].lines.length, 2);
});

Deno.test("handler: station_lines は ids 未指定を 400 にする", async () => {
  const res = await handleRequest(
    new Request("http://local/x?action=station_lines&mock=1"),
  );
  assertEquals(res.status, 400);
});

Deno.test("handler: railway_geometry (mock=1) は MultiLineString を返す", async () => {
  const res = await handleRequest(
    new Request(
      "http://local/x?action=railway_geometry&line_id=00000766&mock=1",
    ),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.data.geometry.type, "MultiLineString");
  assertEquals(body.data.geometry.coordinates.length, 2);
  assertEquals(body.data.color, "#F62E36");
});

Deno.test("handler: railway_geometry は line_id 未指定を 400 にする", async () => {
  const res = await handleRequest(
    new Request("http://local/x?action=railway_geometry&mock=1"),
  );
  assertEquals(res.status, 400);
});
