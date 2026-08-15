export type Locale = 'ja' | 'zh'

const dict = {
  appTitle: { ja: 'SUUMAP', zh: 'SUUMAP' },
  searchPlaceholder: {
    ja: '会社名・住所・駅名を入力',
    zh: '输入公司名、地址或车站名',
  },
  searchButton: { ja: '物件を検索', zh: '搜索房源' },
  commuteMode: { ja: '通勤手段', zh: '通勤方式' },
  maxCommute: { ja: '最大通勤時間', zh: '最长通勤时间' },
  arrivalTime: { ja: '到着時刻', zh: '到岗时间' },
  mode_transit: { ja: '公共交通', zh: '公共交通' },
  mode_walk_transit: { ja: '徒歩+公共交通', zh: '步行+公共交通' },
  mode_car: { ja: '車', zh: '汽车' },
  mode_bicycle: { ja: '自転車', zh: '自行车' },
  mode_walk: { ja: '徒歩', zh: '步行' },
  filters: { ja: '絞り込み', zh: '筛选条件' },
  rent: { ja: '家賃', zh: '月租' },
  minRent: { ja: '下限', zh: '最低' },
  maxRent: { ja: '上限', zh: '最高' },
  area: { ja: '面積', zh: '面积' },
  layout: { ja: '間取り', zh: '户型' },
  buildingAge: { ja: '築年数', zh: '建筑年龄' },
  stationWalk: { ja: '駅徒歩', zh: '到车站步行' },
  amenities: { ja: '設備', zh: '设施' },
  petsAllowed: { ja: 'ペット可', zh: '可养宠物' },
  furnished: { ja: '家具付き', zh: '带家具' },
  bathToiletSeparate: { ja: 'バス・トイレ別', zh: '独立卫浴' },
  autoLock: { ja: 'オートロック', zh: '自动门锁' },
  deliveryBox: { ja: '宅配ボックス', zh: '快递柜' },
  parkingAvailable: { ja: '駐車場', zh: '停车位' },
  bicycleParking: { ja: '駐輪場', zh: '自行车停车位' },
  internetFree: { ja: 'ネット無料', zh: '免费网络' },
  sort: { ja: '並び替え', zh: '排序' },
  sort_recommended: { ja: 'おすすめ順', zh: '综合推荐' },
  sort_commute: { ja: '通勤時間が短い順', zh: '通勤时间最短' },
  sort_rent_asc: { ja: '家賃が安い順', zh: '月租最低' },
  sort_area_desc: { ja: '面積が広い順', zh: '面积最大' },
  sort_station_walk: { ja: '駅から近い順', zh: '距车站最近' },
  sort_newest_building: { ja: '築年数が新しい順', zh: '建筑最新' },
  sort_initial_cost: { ja: '初期費用が安い順', zh: '初期费用最低' },
  sort_updated: { ja: '更新が新しい順', zh: '最近更新' },
  resultsCount: {
    ja: (n: number) => `${n}件の物件が見つかりました`,
    zh: (n: number) => `找到${n}套符合条件的房源`,
  },
  noResults: {
    ja: '条件に合う物件が見つかりませんでした。条件を緩めてお試しください。',
    zh: '没有找到符合条件的房源，请放宽筛选条件后重试。',
  },
  estimated: { ja: '推定', zh: '估算' },
  demoData: { ja: 'デモデータ', zh: '演示数据' },
  commuteTime: { ja: '通勤時間', zh: '通勤时间' },
  transfers: { ja: '乗換', zh: '换乘' },
  fare: { ja: '運賃', zh: '车费' },
  score: { ja: 'おすすめ度', zh: '推荐分' },
  favorite: { ja: 'お気に入り', zh: '收藏' },
  compare: { ja: '比較', zh: '比较' },
  detail: { ja: '詳細', zh: '详情' },
  close: { ja: '閉じる', zh: '关闭' },
  managementFee: { ja: '管理費', zh: '管理费' },
  deposit: { ja: '敷金', zh: '押金' },
  keyMoney: { ja: '礼金', zh: '礼金' },
  totalMonthlyCost: { ja: '月間住居コスト', zh: '月度居住总成本' },
  routeSummary: { ja: 'ルート概要', zh: '路线摘要' },
  demoModeNotice: {
    ja: 'デモ推定：駅ネットワークの平均時間に基づきます。実際の時刻表とは異なります。',
    zh: '演示估算：基于车站网络平均时间，不代表实时列车时刻。',
  },
  fallbackNotice: {
    ja: '正確な経路を取得できないため、デモ推定モードに切り替えました。',
    zh: '当前无法获取精确公共交通路线，已切换为演示估算模式。',
  },
  searchArea: { ja: '事前絞り込み範囲', zh: '预筛选范围' },
  isochroneArea: { ja: '通勤到達圏', zh: '通勤可达圈' },
  listingPoint: { ja: '物件（クリックで詳細）', zh: '房源（点击查看详情）' },
  routeTransitLine: { ja: '乗車区間', zh: '乘车区间' },
  routeWalkLine: { ja: '徒歩区間', zh: '步行区间' },
  company: { ja: '勤務地', zh: '公司地点' },
  selectOnMap: { ja: '地図上で選択', zh: '在地图上选点' },
  debugPanel: { ja: 'デバッグ', zh: '调试' },
  favoritesLocalNotice: {
    ja: 'お気に入りはこのブラウザにのみ保存されます。',
    zh: '收藏仅保存在当前浏览器中。',
  },
  updatedAt: { ja: '更新日', zh: '更新时间' },
  dataSource: { ja: 'データ提供', zh: '数据来源' },
  loading: { ja: '検索中…', zh: '搜索中…' },
  geocodeAddress: {
    ja: '住所・地名から座標を検索',
    zh: '将地址/地名转换为坐标',
  },
  geocodeLoading: { ja: '住所を変換中…', zh: '正在转换地址…' },
  geocodeNoResult: {
    ja: '住所を変換できませんでした。表記を変えてお試しください。',
    zh: '无法转换该地址，请更换写法后重试。',
  },
} as const

type DictKey = keyof typeof dict

export function t(locale: Locale, key: DictKey): string {
  const v = dict[key][locale]
  return typeof v === 'string' ? v : ''
}

export function tf(locale: Locale, key: 'resultsCount', n: number): string {
  const v = dict[key][locale]
  return typeof v === 'function' ? v(n) : String(v)
}
