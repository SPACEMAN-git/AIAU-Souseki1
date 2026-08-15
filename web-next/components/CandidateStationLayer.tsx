"use client";

import { useEffect, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { ReachableStation } from "../lib/navitimeProxy";
import { distanceToMultiLineString } from "../lib/geo";
import type { RailwayLine } from "../lib/railwayCache";
import type { StationMarkerRegistry } from "../lib/markerRegistry";
import styles from "./MapMarkers.module.css";

const SCOPE = "candidate";
// 「この路線沿い」と見なす候補駅までの距離（路線への所属判定の近似）
const NEAR_LINE_METERS = 300;
// これより広域では marker を小さくして 200 駅でも読めるようにする
const FAR_ZOOM = 12;

export interface CandidateStationLayerProps {
  map: maplibregl.Map | null;
  /** reachable の全候補駅（間引きや削除はしない） */
  stations: ReachableStation[];
  /** 主要起点駅として別 layer で描く駅の ID */
  excludeIds: Set<string>;
  /** 通勤時間の上限。marker の強弱付けにのみ使う */
  term: number;
  selectedLine: RailwayLine | null;
  registry: StationMarkerRegistry;
}

// 通勤時間が短いほど強く見せる（サイズ・濃度・透明度の 3 段階）
function stationLevel(timeMinutes: number, term: number): 1 | 2 | 3 {
  const ratio = term > 0 ? timeMinutes / term : 1;
  if (ratio <= 1 / 3) return 1;
  if (ratio <= 2 / 3) return 2;
  return 3;
}

function popupContent(station: ReachableStation): HTMLElement {
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

/** 候補駅 marker。RailwayLayer より前面、主要起点駅より後面 */
export default function CandidateStationLayer(
  {
    map,
    stations,
    excludeIds,
    term,
    selectedLine,
    registry,
  }: CandidateStationLayerProps,
) {
  const [far, setFar] = useState(false);

  useEffect(() => {
    if (!map) return;
    const sync = () => setFar(map.getZoom() < FAR_ZOOM);
    sync();
    map.on("zoomend", sync);
    return () => {
      map.off("zoomend", sync);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const nearLine = (station: ReachableStation): boolean =>
      selectedLine !== null &&
      distanceToMultiLineString(station, selectedLine.geometry.coordinates) <=
        NEAR_LINE_METERS;

    for (const station of stations) {
      if (excludeIds.has(station.id)) continue;
      if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) {
        continue;
      }
      const el = document.createElement("div");
      el.className = [
        styles.candidate,
        styles[`level${stationLevel(station.timeMinutes, term)}`],
        far ? styles.far : "",
        selectedLine
          ? nearLine(station) ? styles.onLine : styles.offLine
          : "",
      ].filter(Boolean).join(" ");
      const label = document.createElement("span");
      label.className = styles.hoverLabel;
      label.textContent = station.name;
      el.append(label);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.lng, station.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 12 }).setDOMContent(
            popupContent(station),
          ),
        )
        .addTo(map);
      registry.register(SCOPE, station.id, marker);
    }
    return () => {
      registry.clearScope(SCOPE);
    };
  }, [map, stations, excludeIds, term, selectedLine, far, registry]);

  return null;
}
