"use client";

import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import styles from "./MapMarkers.module.css";

/** Task 6 で Supabase の listings をそのまま渡せる形。ダミーデータは持たない */
export interface PropertyMarkerData {
  id: string;
  lat: number;
  lng: number;
  title: string;
  /** 表示用の賃料（円）。無い場合は marker に「物件」と出す */
  rent?: number | null;
}

export interface PropertyLayerProps {
  map: maplibregl.Map | null;
  properties: PropertyMarkerData[];
  onSelect?: (id: string) => void;
}

function rentLabel(rent: number | null | undefined): string {
  if (rent == null || !Number.isFinite(rent)) return "物件";
  return `${Math.round(rent / 1000) / 10}万`;
}

/** 物件 marker。候補駅・主要起点駅より前面、勤務先より後面 */
export default function PropertyLayer(
  { map, properties, onSelect }: PropertyLayerProps,
) {
  useEffect(() => {
    if (!map || properties.length === 0) return;
    const markers: maplibregl.Marker[] = [];
    for (const property of properties) {
      if (!Number.isFinite(property.lat) || !Number.isFinite(property.lng)) {
        continue;
      }
      const el = document.createElement("div");
      el.className = styles.property;
      el.textContent = rentLabel(property.rent);
      el.title = property.title;
      if (onSelect) {
        el.addEventListener("click", () => onSelect(property.id));
      }
      markers.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([property.lng, property.lat])
          .addTo(map),
      );
    }
    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [map, properties, onSelect]);

  return null;
}
