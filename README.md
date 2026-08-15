# SUUMAP（通勤圏さがし）

勤務地・通勤手段・最大通勤時間から、条件を満たす賃貸物件を「地図＋リスト」で探せる Web アプリの MVP です。仕様は `prompt.md` を参照してください。

**現在バンドルされている物件データはすべて架空のデモデータです（`is_demo = true`）。実在の物件ではありません。**

## 構成

```
web/       Vite + React + TypeScript フロントエンド
supabase/  PostgreSQL/PostGIS マイグレーション・seed・Edge Functions
data/      物件 CSV インポートテンプレート
```

- 地図: MapLibre GL JS ＋ 国土地理院（GSI）淡色地図タイル（出典表示あり）
- 状態管理: Zustand / スタイル: Tailwind CSS v4
- 経路計算 Provider 抽象: NAVITIME / OpenRouteService（Edge Function 経由）→ Demo 推定へフォールバック
- デモ公共交通: 都内の駅ネットワーク＋ダイクストラ法による**推定**（実時刻表ではありません。UI に「推定」表示）

## クイックスタート（デモモード・API キー不要）

```bash
cd web
npm install
npm run dev
```

`.env` なしで動作します（`VITE_DEMO_MODE=true` 相当）。80 件の架空物件・デモ駅ネットワークで全機能を試せます。

住所→座標変換（Geocoding.jp）: 検索欄に住所を入力して Enter（または候補内のボタン）で座標に変換できます。Supabase 接続時は Edge Function `geocode-place` 経由、未接続の開発時は Vite dev プロキシ `/geocoding-api` 経由で直接呼び出します（約 10 秒に 1 リクエストの制限をクライアント側でも遵守）。

## 検索アルゴリズム（階層型）

1. 交通手段×最大時間から検索半径を推定
2. 半径プレフィルタ（Supabase 接続時は PostGIS RPC `search_listings_in_radius`、未接続時はローカル haversine）
3. 到達圏ポリゴンで絞り込み（point-in-polygon）
4. Provider チェーンでバッチ経路検証（セッション内キャッシュあり）
5. 最大通勤時間・乗換数・駅徒歩で最終フィルタ → 0〜100 のおすすめスコア算出（根拠付き）

## Supabase を使う場合

```bash
supabase db push          # supabase/migrations/0001_init.sql
psql < supabase/seed.sql  # デモデータ投入（または SQL Editor で実行）
supabase functions deploy geocode-place calculate-route calculate-commute-batch calculate-isochrone import-listings
```

`web/.env`（`web/.env.example` 参照）:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_DEMO_MODE=false
```

### API キー（サーバー側のみ）

第三者 API キーはブラウザに一切渡しません。Edge Function の secret として設定します:

```bash
supabase secrets set NAVITIME_RAPIDAPI_KEY=...   # NAVITIME（RapidAPI 経由）
supabase secrets set ORS_API_KEY=...             # OpenRouteService
```

任意の追加設定:

| secret | 既定値 | 用途 |
| --- | --- | --- |
| `NAVITIME_RAPIDAPI_HOST` | `navitime-route-totalnavi.p.rapidapi.com` | RapidAPI ホスト |
| `NAVITIME_MAX_CALLS_PER_REQUEST` | `100` | 1 検索が消費できる NAVITIME 呼び出し上限（クォータ保護） |

NAVITIME にはバッチ経路 API がないため、`calculate-commute-batch` は未キャッシュの物件のみ並列度 6 で個別に `route_transit` を呼び、結果を `commute_cache`（TTL 3 日）に保存します。未キャッシュ件数が上限を超える場合は勤務地に近い順に上限まで実経路を取得し、残り（最も遠く通勤時間上限を超える可能性が高い物件）は結果から除外します。

キー未設定時、各 Edge Function は `503 provider_unavailable` を返し、フロントは自動的にデモ推定モードへ降級します（UI にバナー表示）。NAVITIME の Web ページのスクレイピングは行いません。結果は `commute_cache` / `isochrone_cache` に TTL 付きでキャッシュされます。

## CSV インポート

テンプレート: `data/listings_template.csv`（必須列: `external_id, title, address, latitude, longitude, monthly_rent, floor_area`）。
Storage の `imports` バケットにアップロード後、`import-listings` Edge Function を `{ "filePath": "..." }` で呼び出すと検証・upsert され、`listing_import_jobs` に記録されます。

## 開発コマンド

```bash
cd web
npm run dev        # 開発サーバー
npm run lint       # oxlint
npm run typecheck  # tsc -b
npm run test       # vitest（22 tests）
npm run build      # 本番ビルド
npx tsx scripts/generateSeed.ts  # supabase/seed.sql 再生成
```

## データ出典

- 地図タイル: [国土地理院](https://maps.gsi.go.jp/development/ichiran.html)
- ジオコーディング（任意）: Geocoding.jp（約 10 秒に 1 リクエストの制限あり、キャッシュ必須）
- 物件データ: 架空のデモデータ（Demo Seed Data）
