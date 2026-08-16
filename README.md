# SUUMAP

**「通勤時間で賃貸を探す」ための Web アプリ**です。SUUMO のような賃貸物件検索と、Google マップのような経路探索・地図表示を 1 つの画面に統合し、*勤務地からの通勤時間*を軸に物件を絞り込めるようにしたものです。

- SUUMO 的な部分: 家賃・間取り・面積・築年数・駅徒歩・設備などによる物件検索とリスト表示
- Google マップ的な部分: 勤務地の地名／住所検索、通勤到達圏の可視化、物件から勤務地までの実経路（乗換・所要時間・運賃）と地図上への経路描画

一般的な物件サイトは「駅からの徒歩分数」までしか扱えませんが、SUUMAP は「自分の勤務地まで実際に何分で行けるか」を検索条件そのものにします。

> ⚠️ 現在バンドルされている物件データはすべて**架空のデモデータ**です（`is_demo = true`）。実在の物件ではありません。実データは正規のライセンス取得後に `import-listings` で投入する想定です。

仕様の原文は `prompt.md` を参照してください。

## 使い方（ユーザー視点の流れ）

1. 勤務地を入力する（会社名・駅名・地名・住所のいずれか。地図クリックでも指定可）
2. 通勤手段（公共交通／徒歩＋公共交通／徒歩／自転車／自動車）、最大通勤時間、到着時刻を選ぶ
3. 家賃・間取り・面積などで絞り込む
4. 条件を満たす物件が**地図上の赤い点＋右側のリスト**に表示される
5. 物件をクリックすると、通勤経路の概要（乗車駅→降車駅・路線名・各区間の分数・運賃）と地図上の経路線（実線＝乗車、破線＝徒歩）が表示される

## アーキテクチャ

```
web/       Vite + React + TypeScript フロントエンド（MapLibre GL JS / Zustand / Tailwind CSS v4）
supabase/  PostgreSQL + PostGIS マイグレーション・seed・Edge Functions
data/      物件 CSV インポートテンプレート
```

| 役割 | 使用しているもの |
| --- | --- |
| 地図タイル | 国土地理院（GSI）淡色地図（無料・キー不要、出典表示あり） |
| 物件検索 | Supabase PostgreSQL + PostGIS（`search_listings_in_radius` RPC） |
| 場所検索（勤務地） | NAVITIME（駅名・住所、部分一致で複数候補）→ OSM Nominatim（施設・建物名）→ Geocoding.jp（完全な住所）の順に補完。入力途中でも候補を提示します |
| 経路・所要時間 | NAVITIME（RapidAPI 経由）: 公共交通・徒歩は `route_transit`、自動車は `route_car`、自転車は `route_bicycle`／OpenRouteService は自転車・自動車の予備（任意）／いずれも失敗時はデモ推定 |
| API キーの保護 | すべて Supabase Edge Function の secret。ブラウザには渡しません |

検索は 5 段階の階層型で、外部 API の呼び出し回数を最小化しています。

1. 交通手段×最大時間から検索半径を推定
2. 半径プレフィルタ（PostGIS RPC。Supabase 未接続時はローカル haversine）
3. 到達圏ポリゴンで絞り込み（point-in-polygon）
4. Provider チェーンでバッチ経路検証（`commute_cache` ＋セッション内キャッシュ）
5. 最大通勤時間・乗換数・駅徒歩で最終フィルタ → 0〜100 のおすすめスコア算出（根拠付き）

## NAVITIME の利用上限とテスト時のルール

NAVITIME の各 API（`navitime-route-totalnavi` / `navitime-route-car` / `navitime-route-bicycle`）は現在 **BASIC プラン＝それぞれ月 500 リクエスト**で、バッチ経路 API が存在しません。つまり未キャッシュの物件 1 件ごとに 1 リクエストを消費します。無計画に検索すると数回で月間上限を使い切ってしまうため、以下を守ってください。

- **1 回の検索（＝テスト 1 回）で消費する NAVITIME 呼び出しは最大 20 件**。`NAVITIME_MAX_CALLS_PER_REQUEST` の既定値が `20` で、`calculate-commute-batch` が超過分を打ち切ります。
- 上限を超える候補は勤務地に**近い順**に 20 件まで実経路を取得し、残り（遠く、通勤時間上限を超える可能性が高い物件）は結果から除外します。全件をデモ推定に落とすことはしません。
- 経路結果は `commute_cache` に **TTL 30 日**で保存されます。同じ条件の再検索は API を消費しません。テストは「新規条件の検索は 1 回だけ、以降はキャッシュで確認」を原則にしてください。
- 月間上限に達すると RapidAPI は 429 を返します。この場合 Edge Function は `503 { error: 'provider_unavailable', reason: 'quota_exceeded' }` を返し、フロントは**デモ推定モード**へ降級して「NAVITIME の月間利用上限に達したため、経路と所要時間はデモ推定です」というバナーを表示します。デモ推定は駅ネットワーク＋ダイクストラ法による概算なので、地図上の経路はほぼ直線になり、最短経路とも一致しません（不具合ではありません）。
- NAVITIME の Web ページのスクレイピングは行いません。

## セットアップ

### デモモード（API キー不要）

```bash
cd web
npm install
npm run dev      # http://localhost:5173/
```

`.env` なしで動作します（`VITE_DEMO_MODE=true` 相当）。80 件の架空物件・デモ駅ネットワークで全機能を試せます。

### Supabase に接続する

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

```bash
supabase secrets set NAVITIME_RAPIDAPI_KEY=...   # NAVITIME（RapidAPI 経由）
supabase secrets set ORS_API_KEY=...             # OpenRouteService（自転車・自動車の予備、任意）
```

任意の追加設定:

| secret | 既定値 | 用途 |
| --- | --- | --- |
| `NAVITIME_RAPIDAPI_HOST` | `navitime-route-totalnavi.p.rapidapi.com` | 経路 API の RapidAPI ホスト |
| `NAVITIME_MAX_CALLS_PER_REQUEST` | `20` | 1 検索が消費できる NAVITIME 呼び出し上限（クォータ保護） |

キー未設定時も各 Edge Function は `503 provider_unavailable` を返し、フロントはデモ推定モードへ降級します（UI にバナー表示）。

## 公開環境

- フロントエンド: GitHub Pages（`main` への push で自動デプロイ）https://spaceman-git.github.io/AIAU-Souseki1/
- バックエンド: Supabase（PostGIS データベース ＋ Edge Functions）

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

## データ出典・注意

- 地図タイル: [国土地理院](https://maps.gsi.go.jp/development/ichiran.html)
- 経路・場所検索: NAVITIME（RapidAPI 経由の正規 API）
- 施設・建物名の候補: [OpenStreetMap Nominatim](https://operations.osmfoundation.org/policies/nominatim/)（無料・キー不要、1 req/s 目安。候補が少ないときのみ呼び出し、結果は `places` にキャッシュ）
- 住所ジオコーディング（フォールバック）: Geocoding.jp（約 10 秒に 1 リクエストの制限あり、キャッシュ必須）
- 物件データ: 架空のデモデータ（Demo Seed Data）。実物件データを扱う場合は提供元のライセンス条件に従ってください。
