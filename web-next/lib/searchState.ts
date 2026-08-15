import type { AccessStation, ReachableStation } from "./navitimeProxy";

export interface Workplace {
  name: string;
  lat: number;
  lng: number;
}

/** 検索フロー全体の状態。地図とレールは常にこの 1 つの状態から描く */
export type SearchStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "no_address" }
  | {
    kind: "done";
    workplace: Workplace;
    /** 全件保持（地図表示用）。リストは visibleCount 件だけ描画する */
    stations: ReachableStation[];
    /** 勤務先から実徒歩 15 分以内の主要起点駅（最大 3 駅）。候補の絞り込みには使わない */
    accessStations: AccessStation[];
    mock: boolean;
    /** 検索時の条件（サマリー表示用） */
    term: number;
    transitLimit: number | null;
  };

export type ValidationError = {
  field: "address" | "term" | "transitLimit";
  message: string;
};
