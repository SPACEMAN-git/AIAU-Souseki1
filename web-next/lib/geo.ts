// 候補駅が選択路線の近くにあるかを判定するための簡易距離計算
const EARTH_RADIUS_M = 6378137;

function toXY(lng: number, lat: number, latRef: number): [number, number] {
  const rad = Math.PI / 180;
  return [
    lng * rad * EARTH_RADIUS_M * Math.cos(latRef * rad),
    lat * rad * EARTH_RADIUS_M,
  ];
}

function distanceToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 点から MultiLineString までの最短距離（m）。緯度基準の平面近似で十分な精度。 */
export function distanceToMultiLineString(
  point: { lat: number; lng: number },
  coordinates: number[][][],
): number {
  const p = toXY(point.lng, point.lat, point.lat);
  let min = Infinity;
  for (const part of coordinates) {
    for (let i = 1; i < part.length; i += 1) {
      const a = toXY(part[i - 1][0], part[i - 1][1], point.lat);
      const b = toXY(part[i][0], part[i][1], point.lat);
      const d = distanceToSegment(p, a, b);
      if (d < min) min = d;
    }
  }
  return min;
}
