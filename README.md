# AIAU-Souseki1 — 通勤時間ベース賃貸検索 (Hackathon MVP)

输入「工作地点地址 + 最大通勤时间」，在地图上可视化可达车站，并按地图范围动态加载周边租赁房源的检索服务。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js (App Router) + TypeScript |
| 地图 | MapLibre GL JS + OpenStreetMap 瓦片 |
| 后端 / DB | Supabase (Postgres + Edge Functions) |
| 外部 API | NAVITIME（经由 RapidAPI）：Geocoding / Reachable / Transport / Route(totalnavi) |
| 部署 | Vercel（前端，Root Directory = `web`）+ Supabase 云端项目 |

详细设计见 [docs/architecture.md](docs/architecture.md)。

## 目录结构

```
.
├── web/                  # Next.js 应用（Vercel 部署根目录）
│   ├── app/              # App Router 页面
│   ├── components/       # UI 组件（MapView, SearchForm, PropertyPanel...）
│   ├── lib/              # supabase client / API 调用等工具
│   └── .env.example      # 前端环境变量模板
├── supabase/
│   ├── migrations/       # 数据库迁移 SQL
│   ├── functions/        # Edge Functions（navitime-proxy 等）
│   └── seed/             # mock 房源种子数据
├── docs/
│   └── architecture.md   # 架构设计文档
└── README.md
```

## 本地运行

前置要求：Node.js 20+、npm。

```bash
cd web
npm install
cp .env.example .env.local   # 填入 Supabase 项目的 URL / anon key
npm run dev                  # http://localhost:3000
```

Supabase 侧（PR2 之后可用）：

```bash
# 安装 Supabase CLI 后
supabase link --project-ref <project-ref>
supabase db push             # 应用 migrations
# seed 数据的导入方式见 supabase/seed/ 内说明
```

Edge Functions 的 RapidAPI Key 通过 Supabase Secrets 配置，**不写入任何提交到 Git 的文件**：

```bash
supabase secrets set RAPIDAPI_KEY=<your-key>
```

## 环境变量

见 [web/.env.example](web/.env.example)。真实的 key/secret 一律不得提交到仓库。

## 开发流程

- 不直接 push `main`，全部通过 PR 合并。
- 任务拆分与 PR 计划见 [docs/architecture.md](docs/architecture.md) 第 6 节。
