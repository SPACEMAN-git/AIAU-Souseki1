// NAVITIME（RapidAPI）実 API 結合テスト。
//
// 単体テスト（navitime.test.ts）は完全に mock で、このファイルだけが実 API を叩く。
// RAPIDAPI_KEY が無い場合はスキップされる（CI で落ちない）。
// RapidAPI の無料プランは各 API 500 req/月 のため、1 回の実行で 9 リクエストに抑える。
//
//   deno test --allow-env --allow-net supabase/functions/navitime-proxy/navitime.integration.test.ts
//
// 注意: レスポンスは出力するが、キーそのものは決してログに出さない。

import { assert, assertEquals } from "jsr:@std/assert@1";
import { handleRequest } from "./index.ts";
import {
  GEOCODING_HOST,
  REACHABLE_HOST,
  ROUTE_HOST,
  TRANSPORT_HOST,
} from "./navitime.ts";

const hasKey = Boolean(Deno.env.get("RAPIDAPI_KEY"));

interface CallStat {
  host: string;
  status: number;
}

const calls: CallStat[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const res = await originalFetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input));
  calls.push({ host: url.hostname, status: res.status });
  return res;
};

async function callProxy(query: string) {
  const res = await handleRequest(new Request(`http://local/x?${query}`));
  const body = await res.json();
  assertEquals(
    res.status,
    200,
    `proxy returned ${res.status}: ${JSON.stringify(body.error ?? {})}`,
  );
  assertEquals(body.ok, true);
  // 実キーで呼べていること（mock フォールバックしていないこと）を確認する。
  assertEquals(body.mock, false);
  return body.data;
}

// 翌日朝 9 時（NAVITIME は過去時刻を受け付けない）
function tomorrow9am(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${
    pad(d.getDate())
  }T09:00:00`;
}

Deno.test({
  name: "integration: NAVITIME 各サービス（実 API）",
  ignore: !hasKey,
  sanitizeResources: false,
  fn: async (t) => {
    await t.step(`geocode @ ${GEOCODING_HOST}`, async () => {
      const data = await callProxy(
        `action=geocode&q=${encodeURIComponent("東京都千代田区丸の内1")}`,
      );
      assert(data.results.length > 0, "geocode results is empty");
      const [first] = data.results;
      assert(
        first.lat > 20 && first.lat < 46 && first.lng > 122 && first.lng < 154,
        `coord out of Japan bbox: ${JSON.stringify(first)}`,
      );
      console.log(
        `  geocode -> ${data.results.length} 件 / 先頭: ${first.name}`,
      );
    });

    await t.step(`geocode 駅名フォールバック @ ${TRANSPORT_HOST}`, async () => {
      // 住所検索は「東京駅」で 0 件なので駅名検索にフォールバックする（上流 2 リクエスト）。
      const data = await callProxy(
        `action=geocode&q=${encodeURIComponent("東京駅")}`,
      );
      assertEquals(data.source, "transport_node");
      assert(data.results.length > 0, "fallback results is empty");
      console.log(`  geocode(fallback) -> 先頭: ${data.results[0].name}`);
    });

    await t.step(`reverse_geocode @ ${GEOCODING_HOST}`, async () => {
      const data = await callProxy(
        "action=reverse_geocode&lat=35.624822&lng=139.742121",
      );
      assert(data.results.length > 0, "reverse_geocode results is empty");
      assert(
        data.results[0].name.startsWith("東京都"),
        `unexpected address: ${data.results[0].name}`,
      );
      console.log(`  reverse_geocode -> ${data.results[0].name}`);
    });

    await t.step(`reachable 30 分 @ ${REACHABLE_HOST}`, async () => {
      const data = await callProxy(
        "action=reachable&lat=35.681&lng=139.767&term=30&transit_limit=2",
      );
      assert(data.stations.length > 0, "reachable stations is empty");
      assertEquals(data.term, 30);
      assertEquals(data.transitLimit, 2);
      assert(
        data.stations.every((s: { timeMinutes: number }) =>
          s.timeMinutes <= 30
        ),
        "station beyond term=30 returned",
      );
      assert(
        data.stations.every((s: { transfers: number }) => s.transfers <= 2),
        "station beyond transit_limit=2 returned",
      );
      const times = data.stations.map((s: { timeMinutes: number }) =>
        s.timeMinutes
      );
      assertEquals(
        [...times].sort((a, b) => a - b),
        times,
        "not sorted by time",
      );
      console.log(
        `  reachable -> ${data.stations.length} 駅 / 最速: ${
          data.stations[0].name
        } ${data.stations[0].timeMinutes}分`,
      );
    });

    await t.step(
      `reachable_area 自転車 30 分 @ ${REACHABLE_HOST}`,
      async () => {
        const data = await callProxy(
          "action=reachable_area&lat=35.665251&lng=139.712092&term=30&mode=bicycle&bicycle_speed=15",
        );
        assertEquals(data.mode, "bicycle");
        assertEquals(data.bicycleSpeed, 15);
        assert(data.boundary.length > 2, "boundary is too small");
        assert(
          data.boundary.every((p: { lat: number; lng: number }) =>
            p.lat > 20 && p.lat < 46 && p.lng > 122 && p.lng < 154
          ),
          "boundary point out of Japan bbox",
        );
        console.log(`  reachable_area -> 境界点 ${data.boundary.length} 件`);
      },
    );

    await t.step(`transport_company @ ${TRANSPORT_HOST}`, async () => {
      const data = await callProxy("action=transport_company&id=00000004");
      assert(data.company, "company not found");
      assertEquals(data.company.id, "00000004");
      assert(data.company.name.length > 0);
      console.log(`  transport_company -> ${data.company.name}`);
    });

    await t.step(`transport 駅メタデータ @ ${TRANSPORT_HOST}`, async () => {
      const data = await callProxy(
        `action=transport&q=${encodeURIComponent("東京駅")}&limit=5`,
      );
      assert(data.nodes.length > 0, "transport nodes is empty");
      const station = data.nodes.find((n: { types: string[] }) =>
        n.types.includes("station")
      );
      assert(station, "no station node returned");
      assert(station.id.length > 0 && station.name.length > 0);
      console.log(
        `  transport -> ${data.nodes.length} 件 / 先頭駅: ${station.name} (${station.id})`,
      );
    });

    await t.step(`route(totalnavi) door-to-door @ ${ROUTE_HOST}`, async () => {
      const data = await callProxy(
        `action=route&from_lat=35.681&from_lng=139.767&to_lat=35.658&to_lng=139.701&start_time=${
          encodeURIComponent(tomorrow9am())
        }`,
      );
      assert(data.routes.length > 0, "routes is empty");
      const [best] = data.routes;
      assert(best.totalMinutes > 0 && best.totalMinutes < 180);
      assert(best.transfers >= 0);
      assert(
        best.sections.some((s: { type: string }) => s.type === "move"),
        "route has no move section",
      );
      console.log(
        `  route -> ${data.routes.length} 経路 / 最短: ${best.totalMinutes}分 乗換${best.transfers}回 運賃${best.fare}円`,
      );
    });

    console.log(
      `\n  実 API リクエスト数: ${calls.length}\n${
        calls.map((c) => `    - ${c.host} => ${c.status}`).join("\n")
      }`,
    );
    assertEquals(calls.length, 9, "unexpected upstream request count");
    assert(
      calls.every((c) => c.status === 200),
      `non-200 upstream response: ${JSON.stringify(calls)}`,
    );
  },
});
