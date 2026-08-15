"use client";

import { useEffect } from "react";
import type * as maplibregl from "maplibre-gl";
import type { RailwayLine } from "../lib/railwayCache";

const SOURCE_ID = "selected-railway";
const LINE_LAYER_ID = "selected-railway-line";
const CASING_LAYER_ID = "selected-railway-casing";

export interface RailwayLayerProps {
  map: maplibregl.Map | null;
  /** 地図に描くのは常に選択中の 1 路線だけ */
  line: RailwayLine | null;
}

function emptyFeature(): GeoJSON.Feature<GeoJSON.MultiLineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates: [] },
  };
}

/**
 * 選択中の 1 路線を MapLibre の line layer として描く。
 * marker は DOM overlay なので、この layer は常に marker より下に表示される。
 */
export default function RailwayLayer({ map, line }: RailwayLayerProps) {
  useEffect(() => {
    if (!map) return;
    let disposed = false;

    const setup = () => {
      if (disposed) return;
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data: emptyFeature() });
      }
      if (!map.getLayer(CASING_LAYER_ID)) {
        map.addLayer({
          id: CASING_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 7,
            "line-opacity": 0.35,
          },
        });
      }
      if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#5a6b7b",
            "line-width": 4,
            "line-opacity": 0.45,
          },
        });
      }
    };

    if (map.isStyleLoaded()) setup();
    else map.once("load", setup);

    return () => {
      disposed = true;
      if (!map.getStyle()) return;
      for (const id of [LINE_LAYER_ID, CASING_LAYER_ID]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      const source = map.getSource(SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!source) return;
      if (!line) {
        source.setData(emptyFeature());
        return;
      }
      source.setData({
        type: "Feature",
        properties: { lineId: line.lineId, lineName: line.lineName },
        geometry: line.geometry,
      });
      if (map.getLayer(LINE_LAYER_ID)) {
        map.setPaintProperty(LINE_LAYER_ID, "line-color", line.color);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [map, line]);

  return null;
}
