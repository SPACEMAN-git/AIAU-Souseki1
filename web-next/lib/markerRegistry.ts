import type * as maplibregl from "maplibre-gl";

/**
 * 地図 layer をまたいで駅 marker を引けるようにする軽い台帳。
 * 各 layer は自分の scope だけを入れ替え、リスト連動（focus）は scope 横断で引く。
 */
export class StationMarkerRegistry {
  private scopes = new Map<string, Map<string, maplibregl.Marker>>();

  register(scope: string, id: string, marker: maplibregl.Marker): void {
    let bucket = this.scopes.get(scope);
    if (!bucket) {
      bucket = new Map();
      this.scopes.set(scope, bucket);
    }
    bucket.set(id, marker);
  }

  /** scope 内の marker をすべて地図から外す（検索や条件の切り替え時に呼ぶ） */
  clearScope(scope: string): void {
    const bucket = this.scopes.get(scope);
    if (!bucket) return;
    bucket.forEach((marker) => marker.remove());
    bucket.clear();
  }

  has(scope: string, id: string): boolean {
    return this.scopes.get(scope)?.has(id) ?? false;
  }

  /** scope をまたいで探す。同じ駅が複数 scope にある場合は先に見つかったもの */
  find(id: string): maplibregl.Marker | undefined {
    let found: maplibregl.Marker | undefined;
    this.scopes.forEach((bucket) => {
      found ??= bucket.get(id);
    });
    return found;
  }
}
