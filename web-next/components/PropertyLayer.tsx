"use client";

import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import type { PropertyListing } from "../lib/listings";
import styles from "./MapMarkers.module.css";

export interface PropertyLayerProps {
  map: maplibregl.Map | null;
  properties: PropertyListing[];
  /** popup の「Door-to-Door 通勤を確認」CTA（Task 7 で経路計算に繋ぐ） */
  onRequestCommute?: (property: PropertyListing) => void;
}

function manEn(yen: number): string {
  return `¥${(Math.round(yen / 1000) / 10).toFixed(1)}万`;
}

function row(label: string, value: string): HTMLElement {
  const line = document.createElement("div");
  line.className = styles.popupRow;
  const key = document.createElement("span");
  key.className = styles.popupKey;
  key.textContent = label;
  const val = document.createElement("span");
  val.textContent = value;
  line.append(key, val);
  return line;
}

function popupContent(
  property: PropertyListing,
  onRequestCommute?: (property: PropertyListing) => void,
): HTMLElement {
  const root = document.createElement("div");
  root.className = styles.popup;

  const title = document.createElement("div");
  title.className = styles.popupTitle;
  title.textContent = property.title;
  root.append(title);

  const rent = document.createElement("div");
  rent.className = styles.popupRent;
  rent.textContent = property.managementFee > 0
    ? `${manEn(property.monthlyRent)}（管理費 ${
      property.managementFee.toLocaleString()
    }円）`
    : manEn(property.monthlyRent);
  root.append(rent);

  root.append(row("間取り", property.layout ?? "—"));
  root.append(
    row("面積", property.floorArea != null ? `${property.floorArea}m²` : "—"),
  );
  root.append(row("最寄駅", property.nearestStationName ?? "—"));
  root.append(
    row("駅徒歩", property.walkMinutes != null ? `${property.walkMinutes}分` : "—"),
  );

  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = styles.popupCta;
  cta.textContent = "Door-to-Door 通勤を確認";
  const ctaNote = document.createElement("div");
  ctaNote.className = styles.popupNote;
  cta.addEventListener("click", () => {
    if (onRequestCommute) {
      onRequestCommute(property);
      return;
    }
    // Task 7（Door-to-Door 経路計算）が繋がるまでの暫定表示
    ctaNote.textContent = "この機能は次のステップで対応します。";
  });
  root.append(cta, ctaNote);

  return root;
}

/** 物件の価格 marker。候補駅・主要起点駅より前面、勤務先より後面 */
export default function PropertyLayer(
  { map, properties, onRequestCommute }: PropertyLayerProps,
) {
  useEffect(() => {
    if (!map) return;
    const markers: maplibregl.Marker[] = [];
    for (const property of properties) {
      if (!Number.isFinite(property.lat) || !Number.isFinite(property.lng)) {
        continue;
      }
      const el = document.createElement("div");
      el.className = styles.property;
      el.textContent = manEn(property.monthlyRent);
      markers.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([property.lng, property.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 14, maxWidth: "260px" })
              .setDOMContent(popupContent(property, onRequestCommute)),
          )
          .addTo(map),
      );
    }
    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [map, properties, onRequestCommute]);

  return null;
}
