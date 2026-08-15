# 架构设计 — 通勤時間ベース賃貸検索 MVP

> 3 天黑客松 MVP。优先完成度，架构从简。

## 1. 产品流程

1. 用户输入**工作地点地址**和**最大通勤时间**（分钟）。
2. 地址 → 经纬度（NAVITIME Geocoding，经 RapidAPI）。
3. 以工作地点为起点，检索通勤时间内可达的**候选车站**（NAVITIME Reachable）。
4. 地图（MapLibre + OSM）上显示：勤務先 marker、候选车站 markers、房源 markers。
5. 用户拖动/缩放地图时，按当前 bounds 从 Supabase 动态加载附近房源。
6. 点击房源 → Door-to-Door 通勤路线详情（NAVITIME Route (totalnavi)）。

## 2. 整体架构

```
浏览器 (Next.js + MapLibre GL JS + OSM 瓦片)
   │
   ├── Supabase Edge Function: navitime-proxy   ← 唯一持有 RAPIDAPI_KEY 的地方
   │       ├─ geocode      : NAVITIME Geocoding（地址→经纬度、autocomplete）
   │       ├─ reachable    : NAVITIME Reachable（可达车站 + 所要时间）
   │       ├─ transport    : NAVITIME Transport（车站/路线信息补充）
   │       └─ route        : NAVITIME Route(totalnavi)（Door-to-Door 阶段）
   │
   └── Supabase Postgres（supabase-js 直连，匿名只读 RLS）
           └─ listings：按地图 bounds 查询房源（团队已建 schema + 80 条演示数据）
```

约束与取舍：

- **NAVITIME 全部经由 RapidAPI**（不等待直接契约）。可用范围：
  - NAVITIME Geocoding / Reachable / Transport / Route(totalnavi)。
  - **不使用** NAVITIME Map API v2、transport_shape（不在 RapidAPI 提供范围内）。
- 地图使用 **MapLibre GL JS + OpenStreetMap**。铁路线路高亮/范围外虚化为后续增强，不阻塞 MVP。
- RapidAPI Key 只存在于 Edge Function（Supabase Secrets），前端不接触。
- 房源使用团队已在 Supabase 项目中建好的 **`listings` 表**（含 80 条演示数据，
  latitude/longitude + PostGIS geom），前端按 bounding-box 查询。
- 不做用户系统/收藏；搜索条件放 URL query + React state。

## 3. 前端组件（web/）

| 组件 | 职责 |
|---|---|
| `MapView` | MapLibre 封装：地图实例、marker 图层管理、`moveend` 上报 bounds |
| `SearchForm` | 工作地址输入（geocode/autocomplete）+ 最大通勤时间滑杆 |
| `WorkplaceMarker` | 勤務先 marker |
| `StationLayer` | 候选车站 markers，按通勤时间分色（≤20 绿 / ≤40 黄 / >40 橙），点击显示站名/所要时间 |
| `PropertyLayer` | 房源 markers，随 bounds 变化防抖重载 |
| `PropertyPanel` / `PropertyCard` | 侧边房源列表：租金、户型、面积、最近车站 |
| `RouteDetail` | 点击房源后的 Door-to-Door 路线详情（时间、换乘） |
| `app/page.tsx` | 组合以上组件，搜索条件同步 URL query |

## 4. Supabase

### 表

房源表采用团队在 Supabase 项目中已建的 `listings`（主要列）：

- `id uuid` / `title` / `property_name` / `address`
- `latitude` / `longitude` / `geom`（PostGIS）
- `monthly_rent` / `management_fee` / `layout` / `floor_area`
- `nearest_station_name` / `walk_minutes_to_station` / `railway_line`
- `image_urls` / `is_available` / `is_demo` 等

另有 `stations`、`places`、`commute_cache`、`isochrone_cache` 等配套表（团队维护）。

可选（后续）：`reachable_cache(cache_key, response jsonb, created_at)` 缓存 Reachable 结果、节省配额。

### Edge Functions

- `navitime-proxy`：单个函数，按 `action`（geocode / reachable / transport / route）分发到对应
  RapidAPI host，附加 `X-RapidAPI-Key`，透传 JSON。
- 房源查询不经过 Edge Function：前端 supabase-js 直接
  `select * from listings where latitude between ... and longitude between ... limit 200`。

### 仓库内保存物

所有 migrations（`supabase/migrations/`）、Edge Functions（`supabase/functions/`）、
seed（`supabase/seed/`）均入库；secrets 只经 `supabase secrets set` / Vercel 环境变量配置。

## 5. NAVITIME (RapidAPI) 端点

| 用途 | RapidAPI 服务 |
|---|---|
| 地址→经纬度 / 输入联想 | NAVITIME Geocoding |
| 可达车站（核心） | NAVITIME Reachable（起点坐标 + term 分钟 → 车站列表与所要时间） |
| 车站/路线补充信息 | NAVITIME Transport |
| Door-to-Door 路线 | NAVITIME Route (totalnavi) |

## 6. PR 任务拆分

| # | PR | 内容 | 依赖 |
|---|---|---|---|
| 1 | scaffold | Next.js 脚手架、README、本文档、目录结构、.env.example、本地运行说明 | — |
| 2 | ~~supabase schema + seed~~ | 已弃用：改用团队在 Supabase 项目中建的 `listings` 表 | — |
| 3 | navitime-proxy | Edge Function（geocode / reachable / transport / route）+ secrets 说明 | 1 |
| 4 | map base | MapView（MapLibre + OSM）、东京中心初始视图、bounds 事件 | 1 |
| 5 | commute search | SearchForm + 勤務先 marker + 候选车站 markers | 3, 4 |
| 6 | property loading | 按 bounds 从 `listings` 动态加载房源 markers + 侧边列表 | 4 |
| 7 | door-to-door | 点击房源 → Route(totalnavi) 路线详情 | 5, 6 |
| 8 | deploy & polish | Vercel 部署、环境变量文档、demo 数据微调、loading/空状态 | 全部 |

后续增强（不阻塞 MVP）：铁路线路高亮、通勤圈范围外虚化、Reachable 结果缓存。

## 7. 环境变量

| 变量 | 位置 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web/.env.local / Vercel | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web/.env.local / Vercel | Supabase 匿名 key（RLS 只读） |
| `RAPIDAPI_KEY` | Supabase Secrets | RapidAPI key，仅 Edge Function 使用 |

真实 key 一律不入库，仓库只维护 `.env.example`。
