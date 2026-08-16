<p align="center">
  <img src="https://raw.githubusercontent.com/SPACEMAN-git/AIAU-Souseki1/agent/suumap-readme-showcase/docs/images/suumap-hero.png" alt="SUUMAP — 通勤条件から、住まいを見つける。" width="100%">
</p>

<h1 align="center">SUUMAP</h1>

<p align="center">
  <strong>「駅から探す」家探しを、「通勤から探す」家探しへ。</strong><br>
  通勤先と希望時間から、条件に合う住まいを地図上で直接探せる Web アプリです。
</p>

<p align="center">
  <a href="https://spaceman-git.github.io/AIAU-Souseki1/"><img src="https://img.shields.io/badge/LIVE_DEMO-5B3FE4?style=for-the-badge" alt="Live Demo"></a>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Supabase-PostGIS-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase PostGIS">
</p>

<p align="center">
  <a href="https://spaceman-git.github.io/AIAU-Souseki1/"><strong>▶ 今すぐ試す</strong></a>
  &nbsp;·&nbsp;
  <a href="#使い方">使い方</a>
  &nbsp;·&nbsp;
  <a href="#アーキテクチャ">アーキテクチャ</a>
</p>

> [!IMPORTANT]
> 現在表示される物件はすべて **架空のデモデータ**です（`is_demo = true`）。実在する募集物件ではありません。実データは正規のライセンス取得後に[...] 

## 家探し、本当に「駅」から始めますか？

多くの人は、家を探し始める前から通勤先と「何分以内で通いたいか」を決めています。それでも一般的な不動産検索では、候補駅を一つずつ指定��[...] 

<p align="center">
  <img src="https://raw.githubusercontent.com/SPACEMAN-git/AIAU-Souseki1/agent/suumap-readme-showcase/docs/images/suumap-problem.png" alt="従来の駅起点検索が抱える問題" width="100%">
</p>

SUUMAP が探すのは「駅」ではなく、**通勤条件に合う住まい**です。

## そこで、SUUMAP。

勤務地・学校などの目的地、移動手段、最大通勤時間を入力すると、条件を満たす候補物件を地図とリストにまとめて表示します。気になる物件を��[...] 

<p align="center">
  <img src="https://raw.githubusercontent.com/SPACEMAN-git/AIAU-Souseki1/agent/suumap-readme-showcase/docs/images/suumap-solution.png" alt="SUUMAP の4つのステップ" width="100%">
</p>

## 4つの特徴

| | 特徴 | できること |
| --- | --- | --- |
| 📍 | **通勤先から検索** | 住みたい駅を知らなくても、会社・学校・施設名・住所から家探しを始められます。 |
| ⏱️ | **希望時間内で絞り込み** | 移動手段と最大通勤時間を指定し、条件を満たす候補だけを表示します。 |
| 🗺️ | **地図で物件を比較** | 候補物件を地図とリストで一覧化し、地図を動かしながらエリアを比較できます。 |
| 🚃 | **通勤ルートを可視化** | 徒歩、乗車路線、乗り換え、所要時間、運賃をドアツードアで確認できます。 |

## 使い方

インストールもログインも不要です。公開デモを開くと、その場で一連の検索を体験できます。

1. [SUUMAP Live Demo](https://spaceman-git.github.io/AIAU-Souseki1/) を開く
2. 通勤先を入力する（会社名・駅名・施設名・地名・住所、または地図クリック）
3. 移動手段・最大通勤時間・到着時刻を選ぶ
4. 家賃・間取り・面積などの条件を設定する
5. 地図上の物件を選び、実際の通勤ルートを確認する

<p align="center">
  <img src="https://raw.githubusercontent.com/SPACEMAN-git/AIAU-Souseki1/agent/suumap-readme-showcase/docs/images/suumap-live-demo.png" alt="SUUMAP の通勤時間とルート内訳" width="100%">
</p>

> **「何分」だけでなく、「どう通うか」まで。**

## できること

| 機能 | 概要 |
| --- | --- |
| 目的地検索 | NAVITIME → OpenStreetMap Nominatim → Geocoding.jp の順で、駅・住所・施設名を補完します。 |
| 地図指定 | 検索だけでなく、地図上をクリックして目的地を指定できます。 |
| 通勤条件検索 | 公共交通、徒歩＋公共交通、徒歩、自転車、自動車と最大通勤時間を指定できます。 |
| 物件フィルター | 家賃、間取り、面積、築年数、駅徒歩、設備などで候補を絞り込めます。 |
| 到達圏表示 | 通勤時間ごとの到達圏を地図上に可視化します。 |
| 物件一覧 | 条件を満たす物件を地図上のマーカーとリストで同時に比較できます。 |
| 経路詳細 | 乗車駅、降車駅、路線、各区間の時間、乗り換え回数、運賃を表示します。 |
| おすすめスコア | 通勤時間・乗換数・駅徒歩などから 0〜100 のスコアを根拠付きで算出します。 |

## 検索の仕組み

外部 API の呼び出し回数を抑えながら精度を高めるため、検索は5段階で処理します。

```text
通勤先・移動手段・最大時間
            │
            ▼
  1. 移動可能な検索半径を推定
            │
            ▼
  2. PostGIS で候補物件を事前抽出
            │
            ▼
  3. 到達圏ポリゴンで絞り込み
            │
            ▼
  4. NAVITIME 等で実経路を検証
            │
            ▼
  5. 時間・乗換・駅徒歩で最終判定
            │
            ▼
      地図＋リスト＋ルート詳細
```

経路結果は `commute_cache` とセッション内キャッシュへ保存し、同じ条件的再搜索外部 API を消費しない設計です。

## アーキテクチャ

```text
Browser
  └─ web/          Vite + React 19 + TypeScript + Tailwind CSS v4
       ├─ MapLibre GL JS       地図・到達圏・経路描画
       ├─ Supabase Client      物件検索・データ取得
       └─ Edge Functions       外部 API の安全な呼び出し

Supabase
  ├─ PostgreSQL + PostGIS      物件・位置情報・キャッシュ
  ├─ Edge Functions            場所検索・経路・到達圏・CSV取込
  └─ Secrets                   API キーをサーバー側で保護

External APIs
  ├─ NAVITIME                  公共交通・徒歩経路
  ├─ OpenRouteService          自転車・自動車（任意）
  ├─ OpenStreetMap Nominatim   施設・建物名候補
  └─ Geocoding.jp              住所検索のフォールバック
```
