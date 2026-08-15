# Edge Functions

## navitime-proxy

NAVITIME（RapidAPI）の唯一の呼び出し口。RapidAPI key はこの関数の環境変数からのみ参照する。

### API

| Action | リクエスト | 返却 data |
|---|---|---|
| geocode | `GET ?action=geocode&q=<住所>` | `{ query, results: [{ name, lat, lng }] }` |
| reachable | `GET ?action=reachable&lat=<lat>&lng=<lng>&term=<1-180>` | `{ origin, term, stations: [{ id, name, lat, lng, timeMinutes }] }`（time 昇順） |

共通レスポンス: `{ ok: true, action, mock, data }` / `{ ok: false, error: { code, message } }`

`&mock=1` を付けるか `RAPIDAPI_KEY` 未設定の場合は mock データを返す（`mock: true` で判別可能）。

### Secrets 設定（コミット禁止）

```bash
supabase secrets set RAPIDAPI_KEY=<your-rapidapi-key>
```

### ローカル実行 / テスト

```bash
# 単体テスト（RAPIDAPI_KEY 不要）
deno test --allow-env supabase/functions/navitime-proxy/

# ローカルサーブ（Supabase CLI）
supabase functions serve navitime-proxy --env-file supabase/functions/.env
curl "http://127.0.0.1:54321/functions/v1/navitime-proxy?action=reachable&lat=35.681&lng=139.767&term=30&mock=1"
```

### デプロイ

```bash
supabase functions deploy navitime-proxy
```

備考: RapidAPI のホスト名は `NAVITIME_GEOCODING_HOST` / `NAVITIME_REACHABLE_HOST` で上書き可能。
実キーでの結合テスト時にパス/パラメータを最終確認する。
