// 生成 mock 房源 seed.sql（确定性：固定随机种子）
// 用法: node generate_seed.mjs > seed.sql
// 覆盖 8 个东京车站周边、每站 10 套、共 80 套。

const STATIONS = [
  { name: "渋谷", lat: 35.658, lng: 139.7016 },
  { name: "新宿", lat: 35.6896, lng: 139.7006 },
  { name: "池袋", lat: 35.7295, lng: 139.7109 },
  { name: "中野", lat: 35.7056, lng: 139.6659 },
  { name: "三軒茶屋", lat: 35.6432, lng: 139.6692 },
  { name: "北千住", lat: 35.7497, lng: 139.8049 },
  { name: "吉祥寺", lat: 35.7031, lng: 139.5797 },
  { name: "武蔵小杉", lat: 35.5766, lng: 139.6597 },
];

const LAYOUTS = [
  { layout: "1K", areaMin: 18, areaMax: 26, rentBase: 70000 },
  { layout: "1DK", areaMin: 25, areaMax: 33, rentBase: 90000 },
  { layout: "1LDK", areaMin: 33, areaMax: 45, rentBase: 120000 },
  { layout: "2LDK", areaMin: 45, areaMax: 62, rentBase: 160000 },
];

const NAME_PREFIXES = ["メゾン", "パーク", "グラン", "サニー", "リバー", "ヒルズ", "コート", "レジデンス"];

// 简单的确定性 PRNG (mulberry32)
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260815);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => min + rand() * (max - min);
const esc = (s) => s.replace(/'/g, "''");

const PER_STATION = 10;
const rows = [];

for (const st of STATIONS) {
  // 站价系数：市中心站更贵
  const priceFactor = between(0.9, 1.25);
  for (let i = 0; i < PER_STATION; i++) {
    const l = pick(LAYOUTS);
    const walk = Math.floor(between(2, 16)); // 徒步 2-15 分
    // 徒步越远越便宜；~±10% 噪声
    const rentRaw = l.rentBase * priceFactor * (1 - walk * 0.012) * between(0.92, 1.08);
    const rent = Math.round(rentRaw / 1000) * 1000;
    const area = between(l.areaMin, l.areaMax).toFixed(1);
    // 距离车站 walk 分钟 ≈ 80m/分，换算为经纬度偏移（1度纬度≈111km）
    const distKm = (walk * 80) / 1000;
    const theta = rand() * Math.PI * 2;
    const lat = st.lat + (distKm / 111) * Math.sin(theta);
    const lng = st.lng + (distKm / (111 * Math.cos((st.lat * Math.PI) / 180))) * Math.cos(theta);
    const name = `${pick(NAME_PREFIXES)}${st.name} ${Math.floor(between(1, 9))}0${Math.floor(between(1, 9))}`;
    const address = `東京都近郊 ${st.name}駅 徒歩${walk}分エリア`;
    rows.push(
      `('${esc(name)}', ${rent}, '${l.layout}', ${area}, '${esc(address)}', ${lat.toFixed(6)}, ${lng.toFixed(6)}, '${esc(st.name)}', ${walk}, null)`
    );
  }
}

console.log("-- 由 generate_seed.mjs 生成，请勿手动编辑（node generate_seed.mjs > seed.sql）");
console.log("truncate table public.properties;");
console.log(
  "insert into public.properties\n  (name, rent, layout, area_m2, address, lat, lng, nearest_station, walk_minutes, image_url)\nvalues"
);
console.log(rows.join(",\n") + ";");
