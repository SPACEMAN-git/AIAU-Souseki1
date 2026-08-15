import { assertEquals } from "jsr:@std/assert@1";
import { normalizeGeocode, normalizeReachable } from "./navitime.ts";
import { mockGeocode, mockReachable } from "./mock.ts";
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
  assertEquals(n.results, [{ name: "東京都渋谷区", lat: 35.66, lng: 139.7 }]);
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
