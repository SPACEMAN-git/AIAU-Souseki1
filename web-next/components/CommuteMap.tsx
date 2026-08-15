"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AccessStation, ReachableStation } from "../lib/navitimeProxy";
import type { RailwayLine } from "../lib/railwayCache";
import { StationMarkerRegistry } from "../lib/markerRegistry";
import RailwayLayer from "./RailwayLayer";
import CandidateStationLayer from "./CandidateStationLayer";
import PrimaryStationLayer from "./PrimaryStationLayer";
import PropertyLayer from "./PropertyLayer";
import type { PropertyListing } from "../lib/listings";
import WorkplaceLayer from "./WorkplaceLayer";
import styles from "./CommuteMap.module.css";

// 国土地理院の淡色地図（公開タイル）。web/ の Vite 前端と同じ底図を使う。
const TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a>';

export interface MapView {
  center: { lat: number; lng: number };
  bounds: { north: number; south: number; east: number; west: number };
  zoom: number;
}

export interface CommuteMapProps {
  workplace: { name: string; lat: number; lng: number } | null;
  stations: ReachableStation[];
  /** 勤務先から徒歩圏内の主要起点駅（最大 3 駅）。候補駅の絞り込みには使わない */
  accessStations: AccessStation[];
  /** 通勤時間の上限。marker の強弱付けに使う */
  term: number;
  /** リストから選ばれた駅へ寄る（同じ駅を再度押しても反応するよう seq を持つ） */
  focus: { stationId: string; seq: number } | null;
  /** 表示中の鉄道路線（常に 1 本だけ。未選択なら null） */
  selectedLine: RailwayLine | null;
  /** 地図上の路線バーから表示を解除する */
  onClearLine?: () => void;
  /** 検索中は地図を軽く伏せる（marker は前回のまま残す） */
  loading?: boolean;
  /** viewport 内の物件（Supabase listings）。未指定なら物件 marker は出ない */
  properties?: PropertyListing[];
  /** 物件 popup の Door-to-Door CTA（Task 7 で経路計算に繋ぐ） */
  onRequestCommute?: (property: PropertyListing) => void;
  /** 物件取得中はカウンタを控えめに出す */
  propertiesLoading?: boolean;
  /** 地図移動後に現在の中心と bounds を通知する（物件の動的読み込み用） */
  onViewChange?: (view: MapView) => void;
}

function toMapView(map: maplibregl.Map): MapView {
  const c = map.getCenter();
  const b = map.getBounds();
  return {
    center: { lat: c.lat, lng: c.lng },
    bounds: {
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    },
    zoom: map.getZoom(),
  };
}

export default function CommuteMap(
  {
    workplace,
    stations,
    accessStations,
    term,
    focus,
    selectedLine,
    onClearLine,
    loading,
    properties,
    onRequestCommute,
    propertiesLoading,
    onViewChange,
  }: CommuteMapProps,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const registryRef = useRef(new StationMarkerRegistry());
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: [TILE_URL],
            tileSize: 256,
            attribution: ATTRIBUTION,
          },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center: [139.767125, 35.681236],
      zoom: 10,
    });
    map.on("moveend", () => onViewChangeRef.current?.(toMapView(map)));
    // fitBounds を待たず初期 viewport でも一度通知する
    map.once("load", () => onViewChangeRef.current?.(toMapView(map)));
    mapRef.current = map;
    setMap(map);

    return () => {
      map.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  // 主要起点駅は専用 layer で描くので候補駅 layer からは外す
  const primaryIds = useMemo(
    () => new Set(accessStations.map((s) => s.id)),
    [accessStations],
  );
  const propertyMarkers = useMemo(() => properties ?? [], [properties]);

  // 検索成功後は勤務先と候補駅すべてが入る範囲へ移動する
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || !workplace) return;
    const bounds = new maplibregl.LngLatBounds(
      [workplace.lng, workplace.lat],
      [workplace.lng, workplace.lat],
    );
    for (const station of stations) {
      if (Number.isFinite(station.lat) && Number.isFinite(station.lng)) {
        bounds.extend([station.lng, station.lat]);
      }
    }
    // 凡例と路線バーに marker が隠れないよう padding を取る
    map.fitBounds(bounds, {
      padding: { top: 48, right: 48, bottom: 96, left: 48 },
      maxZoom: 14,
      duration: 600,
    });
  }, [workplace, stations]);

  useEffect(() => {
    fitAll();
  }, [fitAll]);

  // リストからの選択で該当駅へ寄せて popup を開く
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const marker = registryRef.current.find(focus.stationId);
    if (!marker) return;
    map.easeTo({ center: marker.getLngLat(), zoom: 14, duration: 600 });
    const popup = marker.getPopup();
    if (popup && !popup.isOpen()) marker.togglePopup();
  }, [focus]);

  return (
    <div className={styles.canvas}>
      <div ref={containerRef} className={styles.map} />
      {/* 重なり順: base → RailwayLayer → 候補駅 → 主要起点駅 → 物件 → 勤務先 */}
      <RailwayLayer map={map} line={selectedLine} />
      <CandidateStationLayer
        map={map}
        stations={stations}
        excludeIds={primaryIds}
        term={term}
        selectedLine={selectedLine}
        registry={registryRef.current}
      />
      <PrimaryStationLayer
        map={map}
        accessStations={accessStations}
        stations={stations}
        registry={registryRef.current}
      />
      <PropertyLayer
        map={map}
        properties={propertyMarkers}
        onRequestCommute={onRequestCommute}
      />
      <WorkplaceLayer map={map} workplace={workplace} />

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.control}
          title="拡大"
          onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
        >
          ＋
        </button>
        <button
          type="button"
          className={styles.control}
          title="縮小"
          onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
        >
          －
        </button>
        <button
          type="button"
          className={styles.control}
          title="勤務先へ戻る"
          disabled={!workplace}
          onClick={() =>
            workplace &&
            mapRef.current?.easeTo({
              center: [workplace.lng, workplace.lat],
              zoom: 14,
              duration: 600,
            })}
        >
          ★
        </button>
        <button
          type="button"
          className={styles.control}
          title="検索範囲にフィット"
          disabled={!workplace}
          onClick={fitAll}
        >
          ⤢
        </button>
      </div>

      {workplace && (
        <div className={styles.areaCount}>
          このエリアの物件：{propertiesLoading ? "…" : `${propertyMarkers.length}件`}
        </div>
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendWorkplace}`} />
          勤務先
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendPrimary}`} />
          主要起点駅
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendCandidate}`} />
          候補駅（大きく濃いほど通勤時間が短い）
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLine} />
          選択中の路線
        </span>
      </div>

      {selectedLine && (
        <div className={styles.lineBar}>
          <span
            className={styles.lineBarSwatch}
            style={{ background: selectedLine.color }}
          />
          <span className={styles.lineBarName}>{selectedLine.lineName}</span>
          {selectedLine.operator && (
            <span className={styles.lineBarOperator}>
              {selectedLine.operator}
            </span>
          )}
          {onClearLine && (
            <button
              type="button"
              className={styles.lineBarClose}
              title="表示を解除"
              onClick={onClearLine}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {loading && <div className={styles.loadingVeil} />}
    </div>
  );
}
