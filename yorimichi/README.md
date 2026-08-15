# Tokyo Commute Finder

Online demo: <https://jiahuicui394-alt.github.io/ddd/>

The public site is a static Next.js export hosted by GitHub Pages. Real TravelTime
and Supabase requests are handled by a separate Vercel backend so API credentials
never enter the browser bundle or GitHub Pages artifact.

这是一个输入目的地和最长通勤时间，返回目的地附近车站、可达车站和匹配租房的 Next.js Demo。

## 搜索流程

1. 输入地点时，通过 TravelTime 与 OpenStreetMap / Photon 返回车站、地址和附近 POI 候选；选择后固定使用该地点坐标。
2. 从 Supabase 的东京车站目录筛选目的地附近候选站。
3. TravelTime Walking Matrix 计算候选站到目的地的实际步行时间。
4. 用户选择一个目的地入口站后，只保留该站同线路的居住候选站；TravelTime Train Matrix 计算候选站到入口站的铁路时间。
5. 用可达站的 `station_key` 匹配 Supabase 房源，并计算严格门到门时间：
   `最终通勤时间 = 房源步行到站 + 候选站到入口站铁路 + 入口站到目的地步行`。
6. 只保留房源步行不超过 12 分钟、最多换乘 1 次且留有 3 分钟缓冲的结果，再展示最多 16 个推荐车站和 48 条房源。

## Demo 数据

- `stations`：150 个东京真实车站基础数据，包括线路与经纬度；站点来源为 HeartRails Express。
- `properties`：450 条程序生成的 MOCK 租房数据，包括租金、户型、面积、楼龄、楼层和经纬度。
- `property_stations`：房源到最近车站的步行时间关系。

房源标题和地址均明确标记为 `MOCK` / `デモ`，不能作为真实房源信息使用。车站数据和房源数据存储在不同表中，后续可独立替换。

## 环境变量

复制 `.env.local.example` 为 `.env.local`，只在本地填写：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key

TRAVELTIME_APP_ID=4e4be0cb
TRAVELTIME_API_KEY=your-secret-key
```

不要给 TravelTime 密钥添加 `NEXT_PUBLIC_` 前缀，也不要提交 `.env.local`。TravelTime 调用只发生在 `app/api/commute/route.ts` 服务端路由中。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`，输入“东京大学”和“35 分钟”进行测试。当前实现按下一个工作日东京时间 09:00 到达计算公共交通。

## 部署

部署到 Vercel 等支持 Next.js Route Handlers 的平台时，需要在项目环境变量中配置 `.env.local.example` 列出的四个变量。真实密钥不得提交到 GitHub。

## 数据来源说明

- 通勤和步行时间：TravelTime API
- 车站名称、线路和坐标：HeartRails Express API
- 地点与 POI 候选：TravelTime、OpenStreetMap / Photon
- 租房信息：本项目生成的 MOCK / DEMO 数据
