"use client";

import { useEffect, useRef, useState } from "react";
import {
  listingsConfigured,
  searchListingsInBounds,
  type ListingBounds,
  type PropertyListing,
} from "./listings";

const DEBOUNCE_MS = 350;

export interface ViewportListings {
  properties: PropertyListing[];
  loading: boolean;
  error: string | null;
}

function boundsKey(b: ListingBounds): string {
  // 微小な移動での再取得を抑える（小数 4 桁 ≒ 11m）
  return [b.north, b.south, b.east, b.west]
    .map((v) => v.toFixed(4))
    .join(",");
}

/**
 * 地図の viewport（moveend 後の bounds）に入る物件を Supabase から取得する。
 * debounce と世代番号で、古いレスポンスが新しい結果を上書きしないようにする。
 */
export default function useViewportListings(
  bounds: ListingBounds | null,
  enabled: boolean,
): ViewportListings {
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const key = bounds ? boundsKey(bounds) : null;

  useEffect(() => {
    if (!enabled || !bounds || !listingsConfigured()) {
      setProperties([]);
      setLoading(false);
      setError(null);
      return;
    }
    const seq = ++seqRef.current;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      searchListingsInBounds(bounds, controller.signal)
        .then((rows) => {
          // 古いリクエストの結果は捨てる
          if (seq !== seqRef.current) return;
          setProperties(rows);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || seq !== seqRef.current) return;
          console.error(err);
          setProperties([]);
          setError("この範囲の物件を取得できませんでした。");
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // bounds は毎回新しいオブジェクトなので、丸めた key で判定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { properties, loading, error };
}
