# Project Prompt
# 网页端通勤租房搜索工具开发Prompt

你是一名资深GIS工程师、全栈开发工程师、数据工程师和产品设计师。请开发一个可实际运行的网页端租房房源搜索工具。

产品核心目标是：

> 用户输入公司或工作地点、通勤方式和最长通勤时间，系统从数据库中搜索出全部满足条件的出租房源，并以“地图点位＋房源列表”的方式呈现。

项目主要面向日本租房场景，优先支持日本地址、公司、车站、铁路和通勤习惯。

不要只制作静态地图或UI原型，必须实现：

* 地点搜索与地理编码
* 通勤时间计算
* 通勤圈展示
* 房源数据库查询
* 地图房源点位
* 房源列表
* 地图与列表联动
* 房源详情
* 缓存与接口限流
* API不可用时的降级方案
* 示例房源数据导入
* 可部署运行的完整项目

---

# 一、重要接口约束

NAVITIME官方API可以作为主要通勤路线提供方，但不能假设它是永久免费、无限调用的公共接口。

开发时必须遵守以下规则：

1. 只使用NAVITIME正式API、官方试用额度或获得授权的API市场接口；
2. 禁止抓取、解析或自动化访问NAVITIME普通网站页面；
3. 禁止通过HTML爬虫批量获取NAVITIME路线结果；
4. NAVITIME API Key必须放在服务端环境变量中；
5. 不能把NAVITIME API Key暴露在浏览器前端；
6. 使用Supabase Edge Function代理NAVITIME请求；
7. 对查询结果进行缓存，避免重复消耗API额度；
8. 达到接口额度时应自动启用降级方案；
9. 所有估算结果必须明确标记为“估算”；
10. 不得把降级估算结果伪装成NAVITIME精确结果。

如果没有NAVITIME API Key，项目仍然必须可以启动、展示地图、搜索房源和完成基本通勤筛选。

---

# 二、技术栈

## 前端

使用：

* React
* TypeScript
* Vite
* MapLibre GL JS
* Tailwind CSS
* Zustand
* TanStack Query
* React Hook Form
* Zod
* Supercluster或MapLibre原生聚合
* Chart.js或ECharts，用于简单统计图

## 后端与数据库

使用Supabase：

* Supabase PostgreSQL
* PostGIS扩展
* Supabase Edge Functions
* Supabase Storage
* Supabase Auth，可选
* Supabase Realtime，可选
* Row Level Security
* PostgreSQL RPC

## 地图

优先使用：

* MapLibre GL JS
* 国土地理院淡色地图或标准地图瓦片
* 其他明确允许使用的开放地图瓦片

必须显示正确的数据来源和地图署名。

不能移除地图提供方要求的版权和署名信息。

## 地理编码

创建可替换的Geocoding Provider接口。

优先支持日本地址的提供方，例如：

* 国土地理院相关地址搜索服务
* Geolonia Community Geocoder或自部署兼容服务
* 其他具有明确免费额度和使用许可的日本地址API

不要默认在Vibe Coding生成的项目中直接接入公共Nominatim实例。

地理编码接口必须：

* 由Edge Function代理
* 带缓存
* 带限流
* 支持Provider切换
* 保存数据来源
* 返回标准化结果

## 路线和通勤时间

创建统一的Commute Provider接口：

```ts
interface CommuteProvider {
  geocodePlace(query: string): Promise<PlaceCandidate[]>
  calculateRoute(input: RouteInput): Promise<RouteResult>
  calculateBatchRoutes(input: BatchRouteInput): Promise<RouteResult[]>
  calculateIsochrone(input: IsochroneInput): Promise<IsochroneResult>
}
```

实现以下Provider：

1. `NavitimeCommuteProvider`
2. `OpenRouteServiceProvider`
3. `DemoTransitProvider`
4. `CachedCommuteProvider`

NAVITIME用于：

* 公共交通
* 步行＋公共交通
* 汽车
* 自行车
* 到达圈或通勤圈
* 换乘次数
* 预计费用
* 路线详情

OpenRouteService只用于其支持的模式，例如：

* 步行
* 自行车
* 汽车

不要用不支持公共交通的API伪造铁路通勤结果。

---

# 三、产品整体布局

网页整体以地图为主要视觉区域。

推荐桌面布局：

* 页面顶部：公司地点和通勤条件搜索栏
* 页面左侧：筛选条件面板
* 页面中间：全屏地图
* 页面下方或右侧：可展开的房源列表
* 点击地图点位：打开房源预览卡片
* 点击房源列表：地图定位并打开详情
* 点击房源详情：打开侧边抽屉或详情页

地图应占据页面主要面积，不能只是一个小型辅助地图。

## 移动端布局

移动端使用：

* 地图作为背景
* 顶部紧凑搜索栏
* 底部可拖动房源列表抽屉
* 点击房源卡片后地图自动定位
* 筛选条件使用全屏弹窗
* 支持地图和列表快速切换

---

# 四、核心搜索流程

用户首次进入页面时看到：

* 公司或工作地点输入框
* 通勤方式
* 最大通勤时间
* 到岗时间
* “搜索房源”按钮

搜索流程：

1. 用户输入公司名称、公司地址、车站或地图地点；
2. 系统调用地理编码服务；
3. 返回多个候选地点；
4. 用户选择正确地点；
5. 地图显示公司位置标记；
6. 用户选择通勤方式；
7. 用户选择最大通勤时间；
8. 用户选择计划到岗时间；
9. 系统计算可达范围；
10. 从数据库筛选位于可达范围内的房源；
11. 对候选房源进一步计算精确通勤时间；
12. 过滤掉超过最大通勤时间的房源；
13. 在地图上显示房源点；
14. 在下方列表显示全部符合条件的房源；
15. 支持继续增加租金、面积等筛选条件；
16. 筛选条件变化后及时更新地图和列表。

## 公司地点输入

输入框支持：

* 公司名称
* 写字楼名称
* 日本地址
* 车站名称
* 邮编
* 地图选点

候选结果显示：

* 地点名称
* 完整地址
* 地点类型
* 所在都道府县
* 经纬度
* 数据来源

用户也可以点击“在地图上选择”，然后直接点击地图设置公司位置。

---

# 五、通勤条件

支持以下通勤方式：

* 公共交通
* 步行＋公共交通
* 汽车
* 自行车
* 步行
* 混合通勤

允许选择最大通勤时间：

* 15分钟
* 20分钟
* 30分钟
* 40分钟
* 45分钟
* 60分钟
* 75分钟
* 90分钟
* 自定义

允许设置：

* 工作日
* 计划到岗时间
* 计划出发时间
* 优先少换乘
* 优先时间短
* 优先费用低
* 是否允许公交车
* 是否允许收费道路
* 最大换乘次数
* 房源到车站最大步行时间

公共交通默认采用“工作日早高峰到达公司”的通勤方向计算，即：

```text
房源 → 公司
```

默认到岗时间可以设置为：

```text
工作日 09:00
```

通勤时间必须包含：

* 房源步行到车站
* 等车时间
* 乘车时间
* 换乘步行
* 换乘等待
* 下车后步行到公司

如果接口无法提供完整数据，必须显示计算范围和数据限制。

---

# 六、通勤圈显示

在地图上显示根据通勤方式和最长时间生成的通勤可达范围。

通勤圈使用半透明多边形：

* 15分钟：深色
* 30分钟：中等透明度
* 45分钟：较浅
* 60分钟：更浅

用户只选择一个时间时，只显示对应的一个通勤圈。

地图图例需要说明：

* 通勤方式
* 最大通勤时间
* 计算时间
* 数据提供方
* 精确路线或估算路线

如果NAVITIME API提供到达圈接口，优先使用真实到达圈。

如果Provider不能生成通勤圈，则：

1. 先根据预计速度计算粗略半径；
2. 使用粗略范围预筛数据库房源；
3. 再逐个或批量计算候选房源的路线时间；
4. 只显示最终满足条件的房源；
5. 将粗略范围标记为“预筛选范围”，不能标记为真实通勤圈。

---

# 七、API额度优化与搜索算法

不能对数据库中的每一套房源都单独调用一次路线API。

使用以下分层算法：

## 第一步：地理范围预筛

根据通勤方式和最大通勤时间估算最大搜索半径。

例如：

* 步行：约1～6公里
* 自行车：约3～20公里
* 汽车：根据道路和时间估算
* 公共交通：使用更宽的范围或真实到达圈

使用PostGIS执行空间查询，筛掉明显不可能满足条件的房源。

## 第二步：通勤圈筛选

如果API返回GeoJSON Polygon或MultiPolygon：

* 将通勤圈保存为PostGIS geography或geometry
* 使用`ST_Intersects`筛选房源
* 只保留位于通勤圈中的房源

## 第三步：批量路线验证

优先使用：

* 到达圈接口
* Matrix接口
* 批量路线接口

避免大量单点Route请求。

## 第四步：精确验证

只对排名靠前或粗筛后的候选房源查询精确路线。

精确验证结果包括：

* 总通勤时间
* 步行时间
* 乘车时间
* 换乘次数
* 预计交通费
* 使用线路
* 数据来源
* 查询时间

## 第五步：缓存

将通勤结果缓存到数据库。

缓存Key至少包含：

* 公司地点坐标
* 房源地点坐标
* 通勤方式
* 到岗时间段
* 工作日类型
* 路线偏好
* Provider名称

经纬度进行合理精度归一化，避免同一地点因为极小坐标差异无法命中缓存。

建议缓存时间：

* 地理编码：30天
* 步行、骑行、汽车静态路线：7～30天
* 公共交通路线：1～7天
* 房源到最近车站：长期缓存
* 到达圈：1～7天

显示缓存数据更新时间。

---

# 八、无NAVITIME Key时的降级方案

项目必须支持Demo Mode。

环境变量：

```env
VITE_DEMO_MODE=true
NAVITIME_API_KEY=
OPENROUTESERVICE_API_KEY=
```

## 步行、自行车和汽车

如果没有NAVITIME Key：

* 使用OpenRouteService免费额度
* 或使用本地缓存的路线结果
* API不可用时采用直线距离估算
* 估算结果明确标注

直线距离估算需要使用不同道路修正系数：

* 步行距离：直线距离×1.2～1.4
* 自行车距离：直线距离×1.15～1.3
* 汽车距离：直线距离×1.2～1.6

速度参数放入配置文件，不要硬编码在组件中。

## 公共交通

如果没有NAVITIME Key，不允许直接伪造精确铁路路线。

Demo Mode采用以下方式之一：

### 方案A：预计算通勤数据

为演示区域准备：

* 车站表
* 铁路线表
* 相邻车站表
* 平均站间时间
* 换乘时间
* 房源最近车站
* 公司最近车站

使用Dijkstra或A*计算简化铁路通勤时间。

计算结果标记：

```text
演示估算：基于车站网络平均时间，不代表实时列车时刻。
```

### 方案B：预生成通勤缓存

为常用公司地点或演示公司预生成：

* 房源通勤时间
* 换乘次数
* 路线摘要
* 预计费用

### 方案C：外部路线确认

在房源详情中提供：

```text
在NAVITIME中确认路线
```

该按钮只打开用户可见的NAVITIME路线搜索页面，不抓取返回数据。

如果无法构造稳定的深链接，则打开NAVITIME路线搜索首页，并让用户自行确认。

---

# 九、房源数据库

使用Supabase PostgreSQL和PostGIS。

## listings表

至少包含：

* id
* external_id
* title
* description
* property_name
* address
* normalized_address
* prefecture
* city
* district
* latitude
* longitude
* location，geography(Point, 4326)
* monthly_rent
* management_fee
* deposit
* key_money
* initial_cost_estimate
* layout
* floor_area
* building_age
* built_year
* floor_number
* total_floors
* structure_type
* nearest_station_name
* nearest_station_id
* walk_minutes_to_station
* railway_line
* image_urls，JSONB
* source_name
* source_url
* available_from
* is_available
* pets_allowed
* furnished
* bath_toilet_separate
* auto_lock
* delivery_box
* parking_available
* bicycle_parking
* created_at
* updated_at
* last_verified_at

建立：

* PostGIS空间索引
* 租金索引
  -面积索引
* 车站索引
* 可用状态索引
* 更新时间索引

如果外部房源数据没有授权，不要爬取真实租房网站。

项目需要提供合法的数据进入方式：

* CSV导入
* JSON导入
* 管理员手动创建
* 获得授权的数据API
* 示例Seed数据

默认生成至少50～100条虚构但结构完整的示例房源，坐标分布在一个选定的日本城市区域。

所有虚构房源必须明确标记为Demo数据，不能冒充真实房源。

---

# 十、筛选条件

除通勤时间外，支持以下筛选：

## 费用

* 最低月租
* 最高月租
* 是否包含管理费
* 押金上限
* 礼金上限
* 初期费用上限
* 是否免押金
* 是否免礼金

## 房屋条件

* 户型
* 最低面积
* 最高面积
* 建筑年龄
* 楼层
* 是否顶层
* 朝向
* 建筑结构
* 入住时间

## 交通条件

* 最大通勤时间
* 最大换乘次数
* 到车站最大步行时间
* 指定铁路线路
* 指定车站
* 是否允许公交

## 设施

* 可养宠物
* 带家具
* 独立卫浴
* 自动门锁
* 快递柜
* 停车位
* 自行车停车位
* 网络免费
* 空调
* 阳台
* 两人入住

筛选变化后：

* 地图点位实时更新
* 房源数量实时更新
* 列表实时更新
* URL Query同步更新
* 刷新页面后可以恢复筛选条件
* 可以复制并分享当前搜索链接

---

# 十一、地图交互

地图需要实现：

* 公司位置标记
* 房源位置标记
* 房源聚合点
* 通勤圈
* 路线预览
* 最近车站
* 地图缩放
* 地图旋转复位
* 定位到当前城市
* 框选地图区域
* “仅搜索当前地图区域”
* “移动地图时自动搜索”开关
* 地图图例
* 数据来源署名

## 房源Marker

Marker颜色可以表示：

* 月租水平
* 通勤时间
* 综合推荐分
* 是否收藏

默认使用通勤时间颜色：

* 0～20分钟：绿色
* 21～30分钟：浅绿色
* 31～45分钟：橙色
* 46～60分钟：红色
* 超出条件：不显示

Marker可以显示简化租金，例如：

```text
¥8.5万
```

## 聚合

房源较多时使用Cluster：

* 显示区域房源数量
* 点击聚合点自动放大
* 不同时一次渲染数千个DOM Marker
* 使用GeoJSON Source和MapLibre Layer提高性能

## 地图与列表联动

鼠标悬停房源卡片：

* 地图对应Marker高亮
* Marker轻微放大

点击房源卡片：

* 地图平滑移动到房源
* 打开房源Popup
* 保持列表滚动位置

点击地图Marker：

* 列表自动滚动到对应房源
* 房源卡片高亮
* 打开简要信息卡片

---

# 十二、房源列表

列表必须展示全部满足条件的房源，并支持分页或无限滚动。

每张房源卡片显示：

* 首图
* 房源名称
* 月租
* 管理费
* 户型
* 面积
* 建筑年龄
* 最近车站
* 到车站步行时间
* 到公司预计通勤时间
* 换乘次数
* 预计通勤费用
* 推荐分
* 收藏按钮
* 数据更新时间

排序方式：

* 综合推荐
* 通勤时间最短
* 月租最低
* 面积最大
* 距离车站最近
* 建筑最新
* 初期费用最低
* 最近更新

显示结果数量，例如：

```text
找到126套符合条件的房源
```

不能只显示当前地图视野中的前20套而声称是全部结果。

如果数据较多：

* 地图显示全部结果的聚合点
* 列表使用服务端分页
* 显示总数量
* 支持继续加载

---

# 十三、房源详情

房源详情采用侧边抽屉或独立页面。

包括：

* 图片轮播
* 月租和管理费
* 初期费用估算
* 户型和面积
* 建筑年份
* 楼层
* 设施标签
* 地址
* 最近车站
* 地图位置
* 到公司的完整通勤信息
* 路线摘要
* 步行时间
* 乘车时间
* 换乘次数
* 预计交通费
* 通勤数据来源
* 计算时间
* 房源数据来源
* 最后确认时间
* 原始房源链接
* 收藏
* 加入比较

路线详情可以显示：

```text
房源步行8分钟
→ 中野站
→ JR中央线
→ 新宿站
→ 步行5分钟
→ 公司
```

如果该路线是估算数据，必须明显标注。

---

# 十四、综合推荐评分

为每套房源计算0～100分的推荐分。

评分维度：

* 通勤时间
* 月租
* 面积
* 到车站步行时间
* 换乘次数
* 建筑年龄
* 初期费用
* 配套设施
* 数据新鲜度

默认权重示例：

* 通勤时间：35%
* 月租：25%
* 面积：15%
* 车站步行：10%
* 换乘次数：5%
* 建筑年龄：5%
* 设施：5%

允许用户调整偏好：

* 更重视通勤
* 更重视租金
* 更重视面积
* 更重视新房
* 自定义权重

评分算法必须：

* 放在独立模块
* 有TypeScript类型
* 可以单元测试
* 显示评分解释
* 不使用无法解释的随机值

房源详情显示：

```text
推荐理由：
通勤仅28分钟；
租金低于同区域平均水平；
距离车站步行6分钟。
```

---

# 十五、可添加的地图信息

根据免费、开放且许可清晰的数据，增加可开关的地图图层。

优先实现：

## 1. 车站和铁路

显示：

* 最近车站
* 铁路线
* 房源到车站连线
* 步行时间

## 2. 生活设施

可选显示：

* 便利店
* 超市
* 医院
* 药店
* 公园
* 学校
* 健身房
* 餐厅

如果使用OpenStreetMap或其他POI数据：

* 遵守数据使用条款
* 显示署名
* 做缓存
* 不滥用公共查询服务
* 不进行大范围高频Overpass请求

## 3. 灾害风险

在数据许可允许时接入国土地理院或日本政府公开图层：

* 洪水风险
* 海啸风险
* 山体滑坡风险
* 地形高程
* 历史灾害信息

这些信息只作为辅助参考，必须显示免责声明：

```text
灾害图层仅供参考，签约前请以当地政府发布的最新官方资料为准。
```

## 4. 区域租金统计

显示：

* 当前区域平均租金
* 每平方米租金
* 相同户型租金中位数
* 当前房源与区域平均值对比

## 5. 通勤成本

如果API提供费用信息，计算：

* 单程费用
* 每日往返费用
* 月度通勤费用估算
* 房租＋通勤成本

提供“居住总成本”指标：

```text
月度居住总成本 =
月租 + 管理费 + 个人承担的月度通勤费用
```

---

# 十六、收藏与比较

用户可以收藏房源。

未登录状态：

* 使用localStorage保存
* 提示数据仅保存在当前浏览器

登录状态：

* 保存到Supabase
* 支持跨设备同步

支持选择2～4套房源进行比较。

比较维度：

* 月租
* 管理费
* 初期费用
* 面积
* 户型
* 建筑年龄
* 车站步行
* 通勤时间
* 换乘次数
* 通勤费用
* 综合评分
* 主要设施

---

# 十七、数据库补充设计

除了`listings`，创建以下表。

## places

缓存地点搜索：

* id
* query
* normalized_query
* name
* address
* latitude
* longitude
* place_type
* provider
* provider_place_id
* raw_data
* expires_at
* created_at

## commute_cache

* id
* origin_hash
* destination_hash
* origin_location
* destination_location
* travel_mode
* departure_or_arrival_time_bucket
* weekday_type
* duration_minutes
* walking_minutes
* transfer_count
* estimated_cost
* route_summary
* route_geometry
* provider
* is_estimated
* raw_response
* expires_at
* created_at

## isochrone_cache

* id
* center_hash
* center_location
* travel_mode
* time_limit_minutes
* time_bucket
* polygon
* provider
* is_estimated
* expires_at
* created_at

## stations

* id
* name
* operator
* railway_line
* latitude
* longitude
* location
* source

## station_edges

用于Demo公共交通图：

* from_station_id
* to_station_id
* average_minutes
* line_name
* transfer_required
* source

## favorites

* id
* user_id
* listing_id
* created_at

## saved_searches

* id
* user_id
* name
* company_place
* commute_conditions
* listing_filters
* created_at
* updated_at

## listing_import_jobs

* id
* file_path
* status
* total_rows
* valid_rows
* invalid_rows
* error_report_path
* created_at
* finished_at

---

# 十八、房源导入

提供CSV导入工具。

CSV至少支持：

```text
external_id
title
address
monthly_rent
management_fee
layout
floor_area
building_age
nearest_station_name
walk_minutes_to_station
latitude
longitude
source_url
```

导入流程：

1. 上传CSV；
2. 校验字段；
3. 标准化地址；
4. 缺少经纬度时加入地理编码队列；
5. 限速调用Geocoding Provider；
6. 显示导入进度；
7. 显示成功和失败数量；
8. 导出错误报告；
9. 根据external_id更新已有房源；
10. 不重复创建相同房源。

批量地理编码不能直接从浏览器对免费公共API发起大量请求，应通过Edge Function排队、限速和缓存。

---

# 十九、Edge Functions

至少实现：

```text
geocode-place
calculate-route
calculate-commute-batch
calculate-isochrone
search-listings
import-listings
refresh-listing-geocodes
get-nearby-pois
```

API Key保存在：

```text
SUPABASE Secrets
```

建议环境变量：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
NAVITIME_API_KEY=
NAVITIME_API_BASE_URL=
OPENROUTESERVICE_API_KEY=
GEOCODING_PROVIDER=
GEOCODING_API_KEY=
VITE_DEMO_MODE=true
```

Edge Function需要：

* 输入校验
* 超时控制
* 重试
* 缓存
* 错误映射
* 请求日志
* 限流
* Provider切换
* 隐藏Secret Key

---

# 二十、状态和异常处理

必须处理：

* 地点没有搜索结果
* 同名公司有多个地点
* 公司地点无法地理编码
* 房源地址无法地理编码
* NAVITIME Key未配置
* NAVITIME额度耗尽
* 路线接口超时
* 到达圈接口失败
* 免费接口限流
* 地图瓦片加载失败
* 没有满足条件的房源
* 房源缺少图片
* 房源坐标异常
* 缓存数据过期
* 列表与地图数据不一致
* 网络断开
* Edge Function错误
* 数据库查询超时
* 用户快速重复提交搜索

错误提示必须使用用户可以理解的语言。

例如：

```text
当前无法获取精确公共交通路线，已切换为演示估算模式。
```

不能只显示：

```text
500 Internal Server Error
```

---

# 二十一、性能要求

* 首屏优先加载地图和搜索框
* 房源图片懒加载
* 地图点位使用图层而非大量DOM
* 使用Marker Cluster
* 查询条件防抖
* 地图移动查询防抖
* 房源列表虚拟滚动
* 服务端分页
* PostGIS空间索引
* API响应缓存
* 避免N+1路线请求
* 取消过期请求
* 新搜索开始时取消旧搜索
* 地图交互保持流畅
* 目标桌面端60 FPS
* 1000个房源点位仍可流畅缩放

---

# 二十二、界面风格

整体风格：

* 简洁
* 现代
* 专业
* 地图优先
* 类似成熟房产地图搜索产品
* 日本本地化界面
* 信息密度适中

颜色建议：

* 公司地点：紫色或蓝色
* 通勤圈：蓝色半透明
* 房源点：根据通勤时间渐变
* 收藏房源：黄色
* 风险图层：红色或橙色
* 车站：深蓝色

需要支持：

* 中文
* 日文
* 货币显示为日元
* 面积显示为平方米
* 日本地址格式
* 日期和时间本地化

---

# 二十三、测试要求

## 单元测试

测试：

* 推荐评分
* 通勤缓存Key
* 坐标归一化
* 租金格式化
* 通勤时间筛选
* GeoJSON解析
* 房源过滤
* CSV字段校验
* Demo铁路最短路径
* API降级逻辑

## 集成测试

测试：

* 输入公司地址并获得候选地点
* 选择公司地点
* 搜索30分钟通勤房源
* 地图显示通勤圈
* 地图显示房源Marker
* 列表展示符合条件的房源
* 点击列表定位Marker
* 点击Marker定位列表
* 修改租金条件后同步更新
* NAVITIME未配置时自动降级
* 缓存命中后不重复调用API
* CSV导入房源
* 收藏和比较房源

## 开发调试功能

提供可关闭的调试面板：

* 当前Provider
* API调用次数
* 缓存命中率
* 搜索阶段
* 粗筛房源数
* 到达圈筛选数量
* 精确验证数量
* 最终结果数量
* 查询耗时
* 当前地图Bounds

生产环境默认隐藏。

---

# 二十四、开发顺序

## 阶段1：地图和示例数据

* 创建React项目
* 接入MapLibre
* 显示日本地图
* 配置正确署名
* 导入示例房源
* 显示Marker和列表
* 实现地图列表联动

## 阶段2：地点搜索

* 建立Geocoding Provider
* 输入公司地址
* 候选地点
* 地图选点
* 公司Marker
* 地点缓存

## 阶段3：基础通勤筛选

* 实现步行、骑行、汽车模式
* 接入OpenRouteService或Demo Provider
* 实现粗略半径和PostGIS筛选
* 显示通勤时间
* 显示估算标记

## 阶段4：NAVITIME

* 实现NAVITIME Provider
* Edge Function代理
* 到达圈
* 批量路线
* 精确路线
* 缓存和额度保护

## 阶段5：完整房源筛选

* 租金
* 面积
* 户型
* 建筑年龄
* 车站步行
* 设施
* 排序
* URL分享

## 阶段6：附加信息

* 最近车站
* POI
* 灾害图层
* 区域租金统计
* 总居住成本
* 推荐评分

## 阶段7：完善

* 收藏
* 比较
* 响应式布局
* CSV导入
* 测试
* 部署
* README

优先完成真正可以搜索和展示房源的MVP，不要在核心搜索未完成时投入大量时间制作复杂动画。

---

# 二十五、交付内容

最终交付：

1. 完整前端代码；
2. Supabase SQL migration；
3. PostGIS配置；
4. Edge Functions；
5. 示例房源Seed数据；
6. 示例车站数据；
7. Demo通勤缓存数据；
8. CSV导入模板；
9. `.env.example`；
10. 地图数据署名；
11. API配置说明；
12. NAVITIME接入说明；
13. 无NAVITIME Key运行说明；
14. 本地启动说明；
15. 部署说明；
16. 测试说明；
17. 数据来源和许可说明；
18. 已知限制。

README需要明确说明：

* NAVITIME不是默认无限免费接口
* 如何申请试用或配置Key
* 不允许爬取NAVITIME网站
* 免费降级模式的精度限制
* 地理编码数据来源
* 地图瓦片来源
* 房源数据来源
* 哪些数据是Demo数据
* 哪些通勤时间是估算值

---

# 二十六、验收标准

项目达到以下条件才算完成：

* 可以输入公司地点
* 可以选择正确的地点候选
* 可以在地图上选择公司位置
* 可以选择通勤方式
* 可以设置最大通勤时间
* 可以设置到岗时间
* 可以从数据库搜索满足条件的房源
* 地图显示所有结果的点位或聚合点
* 列表显示所有结果并支持分页
* 点击地图点位可以查看房源
* 点击列表可以定位地图点位
* 可以显示通勤时间
* 可以区分精确数据和估算数据
* 可以显示通勤圈或预筛选范围
* 可以按租金、面积、户型等筛选
* 可以按通勤时间和推荐分排序
* 可以查看房源详情
* 可以查看路线摘要
* 可以收藏和比较房源
* NAVITIME Key不会暴露在前端
* 未配置NAVITIME时项目仍可运行
* 不抓取NAVITIME网站
* API结果具有缓存
* 地图显示正确署名
* 示例数据明确标记为Demo
* README可以指导开发者从零启动项目

先完成一个覆盖单个城市、50～100套示例房源、支持公司地点搜索和通勤时间过滤的稳定MVP，再扩展到日本全国、真实房源数据和更复杂的公共交通路线。
# Supabase后端强制要求

本项目必须使用Supabase作为唯一的业务后端和数据库服务。

除前端静态网页托管外，不允许使用：

* Firebase
* MongoDB
* MySQL
* PlanetScale
* Appwrite
* 独立Node.js后端
* 独立Python后端
* 独立Java或Go后端
* 其他云数据库
* 其他Serverless数据库

所有业务后端能力按照以下方式实现：

| 功能                   | Supabase服务                |
| -------------------- | ------------------------- |
| 房源数据存储               | PostgreSQL                |
| 地理位置与空间筛选            | PostGIS                   |
| 公司地点缓存               | PostgreSQL                |
| 通勤路线缓存               | PostgreSQL                |
| 通勤圈存储与空间相交           | PostGIS                   |
| 用户注册和登录              | Supabase Auth             |
| 收藏与搜索记录              | PostgreSQL                |
| CSV房源文件              | Supabase Storage          |
| 房源图片                 | Supabase Storage或授权外部图片地址 |
| NAVITIME接口代理         | Supabase Edge Functions   |
| Geocoding接口代理        | Supabase Edge Functions   |
| OpenRouteService接口代理 | Supabase Edge Functions   |
| API Key管理            | Supabase Secrets          |
| 批量房源搜索               | PostgreSQL RPC            |
| 空间范围查询               | PostgreSQL RPC＋PostGIS    |
| 房源更新通知               | Supabase Realtime，可选      |
| 数据访问权限               | Row Level Security        |
| 数据导入任务状态             | PostgreSQL                |
| 缓存过期清理               | Supabase定时任务或数据库任务        |

## 前端与Supabase通信

前端通过`@supabase/supabase-js`连接Supabase。

前端只允许使用：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

以下密钥绝对不能进入前端：

* Supabase Secret Key
* `service_role` Key
* NAVITIME API Key
* OpenRouteService API Key
* Geocoding Provider Secret
* 任何具有管理权限的密钥

第三方API调用流程必须是：

```text
浏览器
→ Supabase Edge Function
→ 查询Supabase缓存
→ 如果未命中，调用第三方API
→ 将结果写入Supabase缓存
→ 返回浏览器
```

禁止采用：

```text
浏览器
→ 直接携带Secret Key调用第三方API
```

## PostGIS要求

在Supabase PostgreSQL中启用PostGIS扩展。

房源位置采用：

```sql
location geography(Point, 4326)
```

通勤圈采用：

```sql
area geography(Polygon, 4326)
```

如果接口可能返回多个不连续区域，则支持：

```sql
area geography(MultiPolygon, 4326)
```

空间查询必须尽量在Supabase数据库完成，而不是把全部房源下载到浏览器后再逐条计算。

至少使用：

* `ST_DWithin`
* `ST_Intersects`
* `ST_Distance`
* `ST_MakePoint`
* `ST_SetSRID`

为房源位置和通勤圈字段建立GIST空间索引。

## 房源搜索RPC

创建安全的PostgreSQL RPC，例如：

```text
search_listings_by_commute_area
```

输入包括：

* 通勤圈GeoJSON
* 最低租金
* 最高租金
* 最低面积
* 户型
* 最大车站步行时间
* 建筑年龄
* 设施条件
* 排序方式
* 页码
* 每页数量

输出包括：

* 房源数据
* 总结果数量
* 到公司距离
* 缓存通勤时间
* 综合推荐分
* 是否为精确通勤结果
* 数据Provider
* 分页信息

数据库先通过空间索引和普通字段完成预筛选，再对少量候选房源调用通勤接口。

不能对数据库中每套房源逐个调用NAVITIME API。

## Supabase Edge Functions

至少创建：

```text
supabase/functions/geocode-place
supabase/functions/calculate-route
supabase/functions/calculate-commute-batch
supabase/functions/calculate-isochrone
supabase/functions/import-listings
supabase/functions/refresh-geocodes
supabase/functions/nearby-pois
```

Edge Function需要实现：

* JWT身份验证
* 输入参数校验
* API Key隐藏
* 请求限流
* 查询缓存
* 超时控制
* 合理重试
* Provider切换
* 统一错误格式
* 请求日志
* 第三方接口额度保护

## 用户数据与RLS

所有用户相关表启用Row Level Security。

至少保证：

* 未登录用户只能读取公开且有效的房源
* 用户只能管理自己的收藏
* 用户只能管理自己的搜索记录
* 用户只能查看自己的导入任务
* 普通用户不能创建或篡改房源
* 只有管理员可以批量导入、修改和下架房源
* 浏览器不能直接写入通勤缓存
* 浏览器不能伪造NAVITIME路线结果
* 浏览器不能直接调用管理员RPC
* 用户不能读取其他用户的私人搜索记录

公共房源读取策略应限制：

```text
is_available = true
```

## Supabase项目交付要求

最终必须提供：

* Supabase数据库Migration
* PostGIS启用脚本
* 表结构
* 索引
* 外键
* RPC函数
* RLS策略
* Storage Bucket配置
* Storage访问策略
* Edge Functions
* Supabase Secrets配置说明
* Seed数据
* `.env.example`
* 本地开发说明
* 生产部署说明

Migration必须可以从空白Supabase项目一次执行完成，不能只在文字中描述需要手动创建哪些表。

如果Vibe Coding工具需要在Supabase Dashboard中执行某项操作，必须在README中给出准确的操作步骤。

除前端静态文件托管外，项目运行时不得依赖任何自建后端服务器。

