"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  accessStations as fetchAccessStations,
  geocode,
  proxyConfigured,
  reachable,
  stationLines as fetchStationLines,
  type StationWithLines,
} from "../lib/navitimeProxy";
import {
  cachedRailwayLine,
  clearRailwayCache,
  loadRailwayLine,
  type RailwayLine,
} from "../lib/railwayCache";
import type { SearchStatus, ValidationError } from "../lib/searchState";
import LeftRail, { type RailTab } from "./LeftRail";
import SearchBar from "./SearchBar";
import styles from "./CommuteSearch.module.css";

// maplibre-gl はブラウザ専用なので SSR を外す
const CommuteMap = dynamic(() => import("./CommuteMap"), { ssr: false });

const PAGE_SIZE = 30;
const ACCESS_WALK_LIMIT = 15;
const ACCESS_MAX = 3;
const EXAMPLE_ADDRESS = "東京都千代田区丸の内1-9-1";

export default function CommuteSearch() {
  const [address, setAddress] = useState("");
  const [term, setTerm] = useState("30");
  const [transitLimit, setTransitLimit] = useState("1");
  const [validation, setValidation] = useState<ValidationError | null>(null);
  const [status, setStatus] = useState<SearchStatus>({ kind: "idle" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [tab, setTab] = useState<RailTab>("stations");
  const [focus, setFocus] = useState<{ stationId: string; seq: number } | null>(
    null,
  );
  // 主要起点駅ごとの利用可能路線（路線選択 UI 用）。検索ごとに入れ替える
  const [lineGroups, setLineGroups] = useState<StationWithLines[]>([]);
  const [selectedLine, setSelectedLine] = useState<RailwayLine | null>(null);
  const [lineLoadingId, setLineLoadingId] = useState<string | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);

  // 路線切り替えでは reachable 検索を再実行せず、geometry だけを取得（同一路線は cache）
  async function onSelectLine(lineId: string, officialColor: string | null) {
    if (selectedLine?.lineId === lineId) {
      setSelectedLine(null);
      return;
    }
    setLineError(null);
    setSelectedLine(cachedRailwayLine(lineId) ?? null);
    setLineLoadingId(lineId);
    try {
      const line = await loadRailwayLine(lineId, officialColor);
      setSelectedLine(line);
      if (line.geometry.coordinates.length === 0) {
        setLineError(
          `${line.lineName} の路線形状を取得できませんでした（NAVITIME から実形状が返りませんでした）。`,
        );
      }
    } catch (err) {
      setSelectedLine(null);
      setLineError(err instanceof Error ? err.message : String(err));
    } finally {
      setLineLoadingId(null);
    }
  }

  function validate(): {
    address: string;
    term: number;
    transitLimit: number | null;
  } | null {
    const addr = address.trim();
    if (!addr) {
      setValidation({
        field: "address",
        message: "勤務先の住所を入力してください。",
      });
      return null;
    }
    const termNum = Number(term);
    if (!Number.isInteger(termNum) || termNum < 1 || termNum > 180) {
      setValidation({
        field: "term",
        message: "通勤時間は 1〜180 分で指定してください。",
      });
      return null;
    }
    let limit: number | null = null;
    if (transitLimit.trim() !== "") {
      const n = Number(transitLimit);
      if (!Number.isInteger(n) || n < 0 || n > 30) {
        setValidation({
          field: "transitLimit",
          message: "乗換回数は 0〜30 回で指定してください。",
        });
        return null;
      }
      limit = n;
    }
    setValidation(null);
    return { address: addr, term: termNum, transitLimit: limit };
  }

  function resetLineState() {
    setSelectedLine(null);
    setLineGroups([]);
    setLineError(null);
    setLineLoadingId(null);
    clearRailwayCache();
  }

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const input = validate();
    if (!input) {
      // 条件が不正なときは前回の結果を残さない
      setStatus({ kind: "idle" });
      resetLineState();
      return;
    }
    if (!proxyConfigured()) {
      setStatus({
        kind: "error",
        message:
          "API の接続先が未設定です。web-next/.env.local に NEXT_PUBLIC_SUPABASE_URL か NEXT_PUBLIC_NAVITIME_PROXY_URL を設定してください。",
      });
      return;
    }
    setStatus({ kind: "loading" });
    setVisibleCount(PAGE_SIZE);
    setFocus(null);
    // 新しい検索では前回の選択路線と geometry cache を破棄する
    resetLineState();
    try {
      const geo = await geocode(input.address);
      const first = geo.data.results[0];
      if (!first) {
        setStatus({ kind: "no_address" });
        return;
      }
      const origin = { lat: first.lat, lng: first.lng };
      // 通勤可達範囲の起点は常に勤務先の実坐標。主要起点駅は地図表示用に並行で取得する。
      const [r, access] = await Promise.all([
        reachable(origin, input.term, input.transitLimit),
        fetchAccessStations(origin, ACCESS_WALK_LIMIT, ACCESS_MAX)
          .catch(() => null),
      ]);
      setStatus({
        kind: "done",
        workplace: { name: first.name, lat: first.lat, lng: first.lng },
        stations: [...r.data.stations].sort(
          (a, b) => a.timeMinutes - b.timeMinutes,
        ),
        accessStations: access?.data.stations ?? [],
        mock: geo.mock || r.mock,
        term: input.term,
        transitLimit: input.transitLimit,
      });
      const accessIds = (access?.data.stations ?? []).map((s) => s.id);
      if (accessIds.length > 0) {
        const lines = await fetchStationLines(accessIds).catch(() => null);
        setLineGroups(lines?.data.stations ?? []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  }

  const done = status.kind === "done" ? status : null;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <span className={styles.brand}>通勤圏サーチ</span>
        <span className={styles.tagline}>
          勤務先から通える駅と賃貸物件を地図で探す
        </span>
        <span className={styles.source}>
          {done?.mock ? "モックデータ" : "実データ（NAVITIME）"}
        </span>
      </header>

      <SearchBar
        address={address}
        term={term}
        transitLimit={transitLimit}
        loading={status.kind === "loading"}
        validation={validation}
        onAddressChange={setAddress}
        onTermChange={setTerm}
        onTransitLimitChange={setTransitLimit}
        onSubmit={onSearch}
      />

      <div className={styles.workspace}>
        <LeftRail
          status={status}
          tab={tab}
          onTabChange={setTab}
          visibleCount={visibleCount}
          onShowMore={() => setVisibleCount((n) => n + PAGE_SIZE)}
          onFocusStation={(stationId) =>
            setFocus((prev) => ({ stationId, seq: (prev?.seq ?? 0) + 1 }))}
          lineGroups={lineGroups}
          selectedLine={selectedLine}
          lineLoadingId={lineLoadingId}
          lineError={lineError}
          onSelectLine={onSelectLine}
          onClearLine={() => setSelectedLine(null)}
          onRetry={() => onSearch()}
          onUseExample={() => setAddress(EXAMPLE_ADDRESS)}
        />

        <div className={styles.mapPane}>
          <CommuteMap
            workplace={done?.workplace ?? null}
            stations={done?.stations ?? []}
            accessStations={done?.accessStations ?? []}
            term={done?.term ?? (Number(term) || 30)}
            focus={focus}
            selectedLine={selectedLine}
            onClearLine={() => setSelectedLine(null)}
            loading={status.kind === "loading"}
          />
        </div>
      </div>
    </div>
  );
}
