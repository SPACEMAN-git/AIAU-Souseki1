# Edge Functions

## navitime-proxy

NAVITIME（RapidAPI）の唯一の呼び出し口。RapidAPI key はこの関数の環境変数からのみ参照する。

### API

| Action | リクエスト | 返却 data |
|---|---|---|
| geocode | `GET ?action=geocode&q=<住所 or 駅名>` | `{ query, source, results: [{ name, lat, lng }] }` |
| reverse_geocode | `GET ?action=reverse_geocode&lat=<lat>&lng=<lng>` | `{ coord, results: [{ name, lat, lng }] }` |
| reachable | `GET ?action=reachable&lat=<lat>&lng=<lng>&term=<1-180>[&transit_limit=<0-30>]` | `{ origin, term, transitLimit, stations: [{ id, name, lat, lng, timeMinutes, transfers }] }`（time 昇順） |
| transport | `GET ?action=transport&q=<駅名>[&limit=<1-30>]` | `{ query, nodes: [{ id, name, ruby, types, address, lat, lng }] }` |
| route | `GET ?action=route&from_lat=&from_lng=&to_lat=&to_lng=[&start_time=<ISO8601>]` | `{ origin, destination, startTime, routes: [{ totalMinutes, transfers, walkDistance, fare, fromTime, toTime, moveTypes, sections }] }`（totalMinutes 昇順） |

利用 API（RapidAPI）と `X-RapidAPI-Host` の対応:

| action | RapidAPI の API | host | endpoint |
|---|---|---|---|
| geocode | NAVITIME Geocoding | `navitime-geocoding.p.rapidapi.com` | `/address?word=` |
| reverse_geocode | NAVITIME Geocoding | `navitime-geocoding.p.rapidapi.com` | `/address/reverse_geocoding?coord=` |
| reachable | NAVITIME Reachable | `navitime-reachable.p.rapidapi.com` | `/reachable_transit?start=&term=` |
| transport | NAVITIME Transport | `navitime-transport.p.rapidapi.com` | `/transport_node?word=` |
| route | NAVITIME Route(totalnavi) | `navitime-route-totalnavi.p.rapidapi.com` | `/route_transit?start=&goal=&start_time=` |

注意: Geocoding の住所検索は住所文字列専用で、「東京駅」のような駅名では 0 件になる。そのため `geocode` は 0 件のとき Transport の駅名検索にフォールバックし、`source` で `address` / `transport_node` を区別できる（フォールバック時は上流 2 リクエスト消費）。
`route` の `fare` は IC 運賃（`unit_48`）を優先し、無ければきっぷ運賃（`unit_0`）を採用する。

共通レスポンス: `{ ok: true, action, mock, data }` / `{ ok: false, error: { code, message } }`

`&mock=1` を付けるか `RAPIDAPI_KEY` 未設定の場合は mock データを返す（`mock: true` で判別可能）。

### Secrets 設定（コミット禁止）

```bash
supabase secrets set RAPIDAPI_KEY=<your-rapidapi-key>
```

### ローカル実行 / テスト

```bash
# 単体テスト（完全 mock / RAPIDAPI_KEY 不要）
deno test --allow-env supabase/functions/navitime-proxy/navitime.test.ts

# 結合テスト（実 API。RAPIDAPI_KEY がある場合のみ実行され、なければ ignore）
# 1 回の実行で 4 リクエスト（各 API 1 回）。無料プランは各 API 500 req/月。
deno test --allow-env --allow-net \
  supabase/functions/navitime-proxy/navitime.integration.test.ts

# ローカルサーブ（Supabase CLI）
supabase functions serve navitime-proxy --env-file supabase/functions/.env
curl "http://127.0.0.1:54321/functions/v1/navitime-proxy?action=reachable&lat=35.681&lng=139.767&term=30&mock=1"
```

### デプロイ

```bash
supabase functions deploy navitime-proxy
```

備考: RapidAPI のホスト名は `NAVITIME_GEOCODING_HOST` / `NAVITIME_REACHABLE_HOST` /
`NAVITIME_TRANSPORT_HOST` / `NAVITIME_ROUTE_HOST` で上書き可能。
上記の host / endpoint / パラメータは実キーによる結合テストで確認済み。
