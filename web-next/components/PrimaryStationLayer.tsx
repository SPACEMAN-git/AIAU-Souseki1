"use client";

import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import type { AccessStation, ReachableStation } from "../lib/navitimeProxy";
import type { StationMarkerRegistry } from "../lib/markerRegistry";
import styles from "./MapMarkers.module.css";

const SCOPE = "primary";

export interface PrimaryStationLayerProps {
  map: maplibregl.Map | null;
  /** 勤務先から徒歩 15 分以内・最大 3 駅（候補駅の絞り込みには使わない） */
  accessStations: AccessStation[];
  /** 通勤時間を popup に出すための候補駅データ（再検索はしない） */
  stations: ReachableStation[];
  registry: StationMarkerRegistry;
}

function popupContent(
  access: AccessStation,
  station: ReachableStation | undefined,
): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.popup;
  const name = document.createElement("strong");
  name.textContent = `◉ ${access.name}`;
  el.append(name);
  if (station) {
    const time = document.createElement("div");
    time.textContent = `通勤時間：${station.timeMinutes}分`;
    const transfers = document.createElement("div");
    transfers.textContent = `乗換：${station.transfers}回`;
    el.append(time, transfers);
  }
  const walk = document.createElement("div");
  walk.textContent =
    `主要起点駅・勤務先から徒歩${access.walkMinutes}分（${access.walkDistance}m）`;
  el.append(walk);
  return el;
}

/** 主要起点駅 marker。候補駅より前面、勤務先より後面 */
export default function PrimaryStationLayer(
  { map, accessStations, stations, registry }: PrimaryStationLayerProps,
) {
  useEffect(() => {
    if (!map) return;
    const byId = new Map(stations.map((s) => [s.id, s]));
    for (const access of accessStations) {
      if (!Number.isFinite(access.lat) || !Number.isFinite(access.lng)) continue;
      const el = document.createElement("div");
      el.className = styles.primary;
      const label = document.createElement("span");
      label.className = styles.primaryLabel;
      label.textContent = access.name;
      el.append(label);
      el.title = `${access.name}（主要起点駅・徒歩${access.walkMinutes}分）`;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([access.lng, access.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 14 }).setDOMContent(
            popupContent(access, byId.get(access.id)),
          ),
        )
        .addTo(map);
      registry.register(SCOPE, access.id, marker);
    }
    return () => {
      registry.clearScope(SCOPE);
    };
  }, [map, accessStations, stations, registry]);

  return null;
}
