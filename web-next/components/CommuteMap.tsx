"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AccessStation, ReachableStation } from "../lib/navitimeProxy";
import { distanceToMultiLineString } from "../lib/geo";
import type { RailwayLine } from "../lib/railwayCache";
import RailwayLayer from "./RailwayLayer";
import styles from "./CommuteMap.module.css";

// 「この路線沿い」と見なす候補駅までの距離（路線への所属判定の近似）
const NEAR_LINE_METERS = 300;

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
  /** Task 6（物件の動的読み込み）用: 地図移動後に現在の中心と bounds を通知する */
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

// 通勤時間が上限に近いほど控えめに見せる（変えるのは opacity だけ）。
function stationLevel(timeMinutes: number, term: number): 1 | 2 | 3 {
  const ratio = term > 0 ? timeMinutes / term : 1;
  if (ratio <= 1 / 3) return 1;
  if (ratio <= 2 / 3) return 2;
  return 3;
}

function stationPopupContent(
  station: ReachableStation,
  access: AccessStation | undefined,
): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.popup;
  const name = document.createElement("strong");
  name.textContent = access ? `◉ ${station.name}` : station.name;
  const time = document.createElement("div");
  time.textContent = `通勤時間：${station.timeMinutes}分`;
  const transfers = document.createElement("div");
  transfers.textContent = `乗換：${station.transfers}回`;
  el.append(name, time, transfers);
  if (access) {
    const walk = document.createElement("div");
    walk.textContent =
      `主要起点駅・勤務先から徒歩${access.walkMinutes}分（${access.walkDistance}m）`;
    el.append(walk);
  }
  return el;
}

// 候補駅リストに含まれない主要起点駅（通勤条件で外れた場合）用の popup
function accessOnlyPopupContent(access: AccessStation): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.popup;
  const name = document.createElement("strong");
  name.textContent = `◉ ${access.name}`;
  const walk = document.createElement("div");
  walk.textContent =
    `主要起点駅・勤務先から徒歩${access.walkMinutes}分（${access.walkDistance}m）`;
  el.append(name, walk);
  return el;
}

function workplacePopupContent(name: string): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.popup;
  const label = document.createElement("strong");
  label.textContent = "★ 勤務先";
  const value = document.createElement("div");
  value.textContent = name;
  el.append(label, value);
  return el;
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
    onViewChange,
  }: CommuteMapProps,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const workplaceMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stationMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
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
    mapRef.current = map;
    setMap(map);

    const stationMarkers = stationMarkersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      setMap(null);
      workplaceMarkerRef.current = null;
      stationMarkers.clear();
    };
  }, []);

  // 勤務先 marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    workplaceMarkerRef.current?.remove();
    workplaceMarkerRef.current = null;
    if (!workplace) return;

    const el = document.createElement("div");
    el.className = styles.workplaceMarker;
    el.textContent = "★";
    el.title = "勤務先";
    workplaceMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([workplace.lng, workplace.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 16 }).setDOMContent(
          workplacePopupContent(workplace.name),
        ),
      )
      .addTo(map);
  }, [workplace]);

  // 候補駅 marker（検索ごとに全入れ替え。0 件やエラー時は marker なし）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    stationMarkersRef.current.forEach((marker) => marker.remove());
    stationMarkersRef.current.clear();

    const accessById = new Map(accessStations.map((s) => [s.id, s]));
    // 路線が選ばれている間は、その路線沿いの候補駅を強調し他を弱める
    const nearLine = (station: ReachableStation): boolean =>
      selectedLine !== null &&
      distanceToMultiLineString(station, selectedLine.geometry.coordinates) <=
        NEAR_LINE_METERS;

    for (const station of stations) {
      if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) {
        continue;
      }
      const access = accessById.get(station.id);
      const el = document.createElement("div");
      el.className = access
        ? `${styles.stationMarker} ${styles.accessMarker}`
        : `${styles.stationMarker} ${
          styles[`level${stationLevel(station.timeMinutes, term)}`]
        }`;
      if (access) {
        const label = document.createElement("span");
        label.className = styles.accessLabel;
        label.textContent = station.name;
        el.append(label);
      }
      if (selectedLine) {
        el.classList.add(
          nearLine(station) ? styles.onLineMarker : styles.offLineMarker,
        );
      }
      el.title = access
        ? `${station.name}（主要起点駅・徒歩${access.walkMinutes}分）`
        : `${station.name} ${station.timeMinutes}分`;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.lng, station.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 12 }).setDOMContent(
            stationPopupContent(station, access),
          ),
        )
        .addTo(map);
      stationMarkersRef.current.set(station.id, marker);
    }

    // 通勤条件で候補駅から外れた主要起点駅も、地図上には起点として残す
    for (const access of accessStations) {
      if (stationMarkersRef.current.has(access.id)) continue;
      if (!Number.isFinite(access.lat) || !Number.isFinite(access.lng)) continue;
      const el = document.createElement("div");
      el.className = `${styles.stationMarker} ${styles.accessMarker}`;
      const label = document.createElement("span");
      label.className = styles.accessLabel;
      label.textContent = access.name;
      el.append(label);
      el.title = `${access.name}（主要起点駅・徒歩${access.walkMinutes}分）`;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([access.lng, access.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 12 }).setDOMContent(
            accessOnlyPopupContent(access),
          ),
        )
        .addTo(map);
      stationMarkersRef.current.set(access.id, marker);
    }
  }, [stations, accessStations, term, selectedLine]);

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
    const marker = stationMarkersRef.current.get(focus.stationId);
    if (!marker) return;
    map.easeTo({ center: marker.getLngLat(), zoom: 14, duration: 600 });
    const popup = marker.getPopup();
    if (popup && !popup.isOpen()) marker.togglePopup();
  }, [focus]);

  return (
    <div className={styles.canvas}>
      <div ref={containerRef} className={styles.map} />
      <RailwayLayer map={map} line={selectedLine} />

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
          候補駅
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
