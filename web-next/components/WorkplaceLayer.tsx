"use client";

import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import styles from "./MapMarkers.module.css";

export interface WorkplaceLayerProps {
  map: maplibregl.Map | null;
  workplace: { name: string; lat: number; lng: number } | null;
}

function popupContent(name: string): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.popup;
  const label = document.createElement("strong");
  label.textContent = "★ 勤務先";
  const value = document.createElement("div");
  value.textContent = name;
  el.append(label, value);
  return el;
}

/** 勤務先 marker（常に最前面・最も目立つ表示） */
export default function WorkplaceLayer(
  { map, workplace }: WorkplaceLayerProps,
) {
  useEffect(() => {
    if (!map || !workplace) return;
    const el = document.createElement("div");
    el.className = styles.workplace;
    el.textContent = "★";
    el.title = "勤務先";
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([workplace.lng, workplace.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 16 }).setDOMContent(
          popupContent(workplace.name),
        ),
      )
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, workplace]);

  return null;
}
