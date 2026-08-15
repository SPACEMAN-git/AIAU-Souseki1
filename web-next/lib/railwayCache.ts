// 路線 geometry はセッション内で lineId ごとに 1 回だけ取得する（切り替え/再選択は cache から）
import {
  type NormalizedRailwayGeometry,
  railwayGeometry,
} from "./navitimeProxy";

export interface RailwayLine {
  lineId: string;
  lineName: string;
  operator: string | null;
  color: string;
  geometry: { type: "MultiLineString"; coordinates: number[][][] };
}

// 公式色が取れなかったときだけ使う抑えた既定色
const FALLBACK_COLOR = "#5a6b7b";

const cache = new Map<string, RailwayLine>();

export function clearRailwayCache(): void {
  cache.clear();
}

export function cachedRailwayLine(lineId: string): RailwayLine | undefined {
  return cache.get(lineId);
}

export async function loadRailwayLine(
  lineId: string,
  officialColor: string | null,
): Promise<RailwayLine> {
  const hit = cache.get(lineId);
  if (hit) return hit;
  const { data } = await railwayGeometry(lineId);
  const line: RailwayLine = {
    lineId: data.lineId,
    lineName: data.lineName,
    operator: data.operator,
    color: officialColor ?? data.color ?? FALLBACK_COLOR,
    geometry: normalizeGeometry(data),
  };
  cache.set(lineId, line);
  return line;
}

function normalizeGeometry(
  data: NormalizedRailwayGeometry,
): RailwayLine["geometry"] {
  const coordinates = (data.geometry?.coordinates ?? []).filter(
    (part) => Array.isArray(part) && part.length >= 2,
  );
  return { type: "MultiLineString", coordinates };
}
