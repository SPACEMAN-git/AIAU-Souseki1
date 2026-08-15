# web-next — Next.js 前端

NAVITIME 通勤検索 UI（`navitime-proxy` Edge Function 経由）。Vercel 部署时以本目录为根目录。
架构说明见 [docs/architecture.md](../docs/architecture.md)，仓库整体说明见 [README.md](../README.md)。
`web/`（Vite + React）是团队的另一套前端，与本目录相互独立。

```bash
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定すると、デプロイ済みの `navitime-proxy` 経由で実 NAVITIME（Geocoding / Reachable transit）を呼ぶ。RapidAPI key は Edge Function 側のみが保持する。
オフライン確認したいときだけ `NEXT_PUBLIC_NAVITIME_MOCK=1` を設定する（結果に「モックデータ」バッジが出る）。
