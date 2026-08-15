"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ReachableStation } from "../lib/navitimeProxy";
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
  /** 通勤時間の上限。marker の強弱付けに使う */
  term: number;
  /** リストから選ばれた駅へ寄る（同じ駅を再度押しても反応するよう seq を持つ） */
  focus: { stationId: string; seq: number } | null;
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

// 通勤時間が上限に近いほど控えめに見せる（3 段階だけの単純な強弱付け）。
function stationLevel(timeMinutes: number, term: number): 1 | 2 | 3 {
  const ratio = term > 0 ? timeMinutes / term : 1;
  if (ratio <= 1 / 3) return 1;
  if (ratio <= 2 / 3) return 2;
  return 3;
}

function stationPopupContent(station: ReachableStation): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.popup;
  const name = document.createElement("strong");
  name.textContent = station.name;
  const time = document.createElement("div");
  time.textContent = `通勤時間：${station.timeMinutes}分`;
  const transfers = document.createElement("div");
  transfers.textContent = `乗換：${station.transfers}回`;
  el.append(name, time, transfers);
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
  { workplace, stations, term, focus, onViewChange }: CommuteMapProps,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
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
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("moveend", () => onViewChangeRef.current?.(toMapView(map)));
    mapRef.current = map;

    const stationMarkers = stationMarkersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
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

    for (const station of stations) {
      if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) {
        continue;
      }
      const el = document.createElement("div");
      el.className = `${styles.stationMarker} ${
        styles[`level${stationLevel(station.timeMinutes, term)}`]
      }`;
      el.title = `${station.name} ${station.timeMinutes}分`;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.lng, station.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 12 }).setDOMContent(
            stationPopupContent(station),
          ),
        )
        .addTo(map);
      stationMarkersRef.current.set(station.id, marker);
    }
  }, [stations, term]);

  // 検索成功後は勤務先と候補駅すべてが入る範囲へ移動する
  useEffect(() => {
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
    map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 });
  }, [workplace, stations]);

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

  return <div ref={containerRef} className={styles.map} />;
}
