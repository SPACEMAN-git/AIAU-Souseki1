# 通勤圏さがし（Souseki）

勤務地・通勤手段・最大通勤時間から、条件を満たす賃貸物件を「地図＋リスト」で探せる Web アプリの MVP です。仕様は `prompt.md` を参照してください。

**現在バンドルされている物件データはすべて架空のデモデータです（`is_demo = true`）。実在の物件ではありません。**

## 構成

```
web/       Vite + React + TypeScript フロントエンド
web-next/  Next.js (App Router) + TypeScript フロントエンド（NAVITIME 通勤検索 UI・`docs/architecture.md` 参照）
supabase/  PostgreSQL/PostGIS マイグレーション・seed・Edge Functions
data/      物件 CSV インポートテンプレート
```

2 つのフロントエンドが並存しています。`web/` と `web-next/` は独立に `npm install` / `npm run dev` します（`web-next/` の手順は `web-next/README.md`）。

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
supabase secrets set NAVITIME_API_KEY=...   # 法人契約/トライアルの正規 API のみ
supabase secrets set ORS_API_KEY=...        # OpenRouteService
```

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
