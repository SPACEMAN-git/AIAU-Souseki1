# SUUMATCH

> **SUUMATCH is the mobile-first version of SUUMAP**, designed to match international residents with homes that fit both their commute and lifestyle.

> **SUUMATCH は SUUMAP のモバイル版**です。通勤条件だけでなく、一人ひとりの暮らし方に合う住まいを提案します。

**Online Demo / オンラインデモ:** <https://jiahuicui394-alt.github.io/ddd/>

---

## 日本語

### SUUMATCH とは

SUUMATCH は、東京で部屋を探す留学生・外国人居住者のための、モバイルファーストな住まいマッチングサービスです。

一般的な物件検索のように「住みたい駅を最初から知っている」ことを前提にせず、正確な目的地、ドアツードアの通勤時間、家賃予算、そして HBTI（Housing Behavior Type Indicator）から、ユーザーに合う物件をランキングします。

**Find a room worth falling for.**

### 主な機能

- 建物・住所・駅・周辺 POI を含む正確な目的地検索
- 自宅から駅、電車・乗換、到着駅から目的地までを含むドアツードア通勤計算
- 理想予算によるマッチスコア調整
- 上限予算を超える物件のハードフィルタリング
- HBTI、優先順位、物件 Swipe、具体的な「好き／避けたい」条件による嗜好学習
- 通勤条件を満たすすべての物件を対象にしたグローバルランキング
- 日本語・英語・中国語の表示切り替え
- スマートフォンで操作しやすいモバイルファースト UI

### 検索とマッチングの流れ

1. 正確な目的地、最大通勤時間、理想予算、上限予算を入力します。
2. TravelTime と OpenStreetMap / Photon から、建物・住所・駅・POI の候補を取得します。
3. 目的地から徒歩15分以内の到着駅を探し、実際の徒歩時間を計算します。
4. TravelTime で鉄道時間と乗換回数を計算します。
5. Supabase の物件を駅情報と結び付け、次の式でドアツードア時間を求めます。

```text
最終通勤時間 = 物件から駅までの徒歩 + 鉄道・乗換 + 到着駅から目的地までの徒歩
```

6. 通勤時間と上限予算を満たす物件だけを候補に残します。
7. 理想予算と HBTI の嗜好プロファイルから Match Score を計算し、すべての候補物件を同じランキングで並べます。

### デモデータについて

- `stations`: 東京の駅名、路線、緯度・経度
- `properties`: 家賃、管理費、間取り、面積、築年数、設備などを含む生成済み物件データ
- `property_stations`: 物件と最寄り駅、徒歩時間の関係

現在表示される物件は、すべて **MOCK / DEMO データ**です。実際に募集中の物件ではなく、契約や問い合わせには使用できません。駅データと物件データは別々に管理しているため、将来実データへ置き換えられます。

### ローカル実行

`.env.local.example` を `.env.local` にコピーし、次の値を設定します。

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key

TRAVELTIME_APP_ID=your-application-id
TRAVELTIME_API_KEY=your-secret-key
```

```bash
npm install
npm run dev
```

ブラウザで <http://localhost:3000> を開きます。TravelTime の秘密鍵に `NEXT_PUBLIC_` を付けたり、`.env.local` を GitHub にコミットしたりしないでください。

---

## English

### What is SUUMATCH?

SUUMATCH is a mobile-first housing matching experience for international students and residents looking for a home in Tokyo.

Unlike conventional rental search platforms, it does not assume that newcomers already know which station they should live near. SUUMATCH combines an exact destination, real door-to-door commute time, rent budgets, and an HBTI (Housing Behavior Type Indicator) preference profile to rank homes according to each user's lifestyle.

**Find a room worth falling for.**

### Key features

- Precise destination search for buildings, addresses, stations, and nearby POIs
- Door-to-door commute calculation covering the home walk, rail journey, transfers, and destination walk
- Match-score adjustment based on the user's ideal monthly budget
- Hard exclusion of homes above the maximum monthly budget
- Preference learning through HBTI, priority ordering, property swipes, and explicit reward/penalty choices
- One global ranking containing every home that meets the commute and budget limits
- Japanese, English, and Chinese interfaces
- A mobile-first interface optimized for smartphone use

### Search and matching flow

1. Enter an exact destination, maximum commute time, ideal budget, and maximum budget.
2. Retrieve building, address, station, and POI suggestions through TravelTime and OpenStreetMap / Photon.
3. Find destination-side stations within a 15-minute walk and calculate the real walking time.
4. Use TravelTime to calculate rail time and transfers.
5. Match reachable station keys with Supabase listings and calculate the complete commute:

```text
Final commute = home-to-station walk + rail/transfers + arrival-station-to-destination walk
```

6. Keep only listings that satisfy both the commute limit and maximum budget.
7. Calculate a personalized Match Score using the ideal budget and HBTI preference profile, then rank every eligible listing together.

### Demo data

- `stations`: Tokyo station names, railway lines, and coordinates
- `properties`: generated listing data including rent, management fee, layout, size, building age, and amenities
- `property_stations`: relationships between listings, nearby stations, and walking times

All listings currently shown are clearly identified **MOCK / DEMO data**. They are not real available rental listings and must not be used for rental enquiries or contracts. Station data and listing data are stored separately so either dataset can be replaced later.

### Local development

Copy `.env.local.example` to `.env.local` and configure:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key

TRAVELTIME_APP_ID=your-application-id
TRAVELTIME_API_KEY=your-secret-key
```

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Never prefix the TravelTime secret with `NEXT_PUBLIC_`, and never commit `.env.local` to GitHub.

### Architecture and deployment

The public frontend is a static Next.js export hosted on GitHub Pages. TravelTime and Supabase requests are handled by a separate server-side deployment, keeping secret credentials out of the browser bundle and GitHub Pages artifact.

### Data sources

- Commute and walking times: TravelTime API
- Station names, lines, and coordinates: HeartRails Express API
- Place and POI suggestions: TravelTime and OpenStreetMap / Photon
- Rental listings: generated MOCK / DEMO data
