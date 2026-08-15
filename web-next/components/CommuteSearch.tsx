"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  type AccessStation,
  accessStations as fetchAccessStations,
  geocode,
  proxyConfigured,
  reachable,
  type ReachableStation,
} from "../lib/navitimeProxy";
import styles from "./CommuteSearch.module.css";

// maplibre-gl はブラウザ専用なので SSR を外す
const CommuteMap = dynamic(() => import("./CommuteMap"), { ssr: false });

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "no_address" }
  | {
    kind: "done";
    workplace: { name: string; lat: number; lng: number };
    // 全件保持（後続の地図表示で使う）し、リストは visibleCount 件だけ描画する
    stations: ReachableStation[];
    // 勤務先から実徒歩 15 分以内の主要起点駅（最大 3 駅）。stations の絞り込みには使わない
    accessStations: AccessStation[];
    mock: boolean;
  };

const PAGE_SIZE = 30;
const ACCESS_WALK_LIMIT = 15;
const ACCESS_MAX = 3;

export default function CommuteSearch() {
  const [address, setAddress] = useState("");
  const [term, setTerm] = useState("30");
  const [transitLimit, setTransitLimit] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [focus, setFocus] = useState<{ stationId: string; seq: number } | null>(
    null,
  );

  function validate(): {
    address: string;
    term: number;
    transitLimit: number | null;
  } | null {
    const addr = address.trim();
    if (!addr) {
      setValidation("勤務先の住所を入力してください。");
      return null;
    }
    const termNum = Number(term);
    if (!Number.isInteger(termNum) || termNum < 1 || termNum > 180) {
      setValidation("通勤時間の上限は 1〜180 の整数（分）で入力してください。");
      return null;
    }
    let limit: number | null = null;
    if (transitLimit.trim() !== "") {
      const n = Number(transitLimit);
      if (!Number.isInteger(n) || n < 0 || n > 30) {
        setValidation("乗換回数の上限は 0〜30 の整数で入力してください。");
        return null;
      }
      limit = n;
    }
    setValidation(null);
    return { address: addr, term: termNum, transitLimit: limit };
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const input = validate();
    if (!input) return;
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
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  }

  return (
    <section className={styles.container}>
      <h1 className={styles.title}>通勤圏サーチ</h1>
      <p className={styles.subtitle}>
        勤務先の住所と通勤条件から、通える駅の候補を探します。
      </p>

      <div className={styles.layout}>
        <div className={styles.panel}>
          <form className={styles.form} onSubmit={onSearch} noValidate>
            <label className={styles.field}>
              <span>勤務先の住所</span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="例：東京都千代田区丸の内1-9-1"
              />
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                <span>通勤時間の上限（分）</span>
                <input
                  type="number"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  min={1}
                  max={180}
                />
              </label>

              <label className={styles.field}>
                <span>乗換回数の上限（空欄 = 制限なし）</span>
                <input
                  type="number"
                  value={transitLimit}
                  onChange={(e) => setTransitLimit(e.target.value)}
                  min={0}
                  max={30}
                  placeholder="例：1"
                />
              </label>
            </div>

            {validation && <p className={styles.validation}>{validation}</p>}

            <button
              type="submit"
              className={styles.button}
              disabled={status.kind === "loading"}
            >
              {status.kind === "loading" ? "検索中…" : "検索"}
            </button>
          </form>

          {status.kind === "loading" && (
            <p className={styles.info}>候補駅を検索しています…</p>
          )}

          {status.kind === "error" && (
            <p className={styles.error}>エラー：{status.message}</p>
          )}

          {status.kind === "no_address" && (
            <p className={styles.info}>
              住所が見つかりませんでした。表記を変えて再度お試しください。
            </p>
          )}

          {status.kind === "done" && (
            <div className={styles.results}>
              <p className={styles.workplace}>
                勤務先：{status.workplace.name}（
                {status.workplace.lat.toFixed(4)},{" "}
                {status.workplace.lng.toFixed(4)}
                ）
                {status.mock && (
                  <span className={styles.badge}>モックデータ</span>
                )}
              </p>
              <div className={styles.accessBlock}>
                <p className={styles.accessTitle}>
                  主要起点駅（勤務先から徒歩{ACCESS_WALK_LIMIT}分以内・最大{" "}
                  {ACCESS_MAX} 駅）
                </p>
                {status.accessStations.length === 0
                  ? (
                    <p className={styles.info}>
                      徒歩{ACCESS_WALK_LIMIT}分以内の鉄道駅は見つかりませんでした。
                    </p>
                  )
                  : (
                    <ul className={styles.stationList}>
                      {status.accessStations.map((s) => (
                        <li key={`access-${s.id}`}>
                          <button
                            type="button"
                            className={`${styles.station} ${styles.accessStation}`}
                            onClick={() =>
                              setFocus((prev) => ({
                                stationId: s.id,
                                seq: (prev?.seq ?? 0) + 1,
                              }))}
                          >
                            <span className={styles.stationName}>
                              ◉ {s.name}
                            </span>
                            <span className={styles.stationMeta}>
                              徒歩{s.walkMinutes}分 ・ {s.walkDistance}m
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
              {status.stations.length === 0
                ? (
                  <p className={styles.info}>
                    条件に合う駅が見つかりませんでした。通勤時間や乗換回数の条件を緩めてみてください。
                  </p>
                )
                : (
                  <>
                    <p className={styles.count}>
                      {status.stations.length}駅が見つかりました
                      {status.stations.length > visibleCount &&
                        `（通勤時間の短い順に上位 ${visibleCount} 駅を表示）`}
                    </p>
                    <ul className={styles.stationList}>
                      {status.stations.slice(0, visibleCount).map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className={styles.station}
                            onClick={() =>
                              setFocus((prev) => ({
                                stationId: s.id,
                                seq: (prev?.seq ?? 0) + 1,
                              }))}
                          >
                            <span className={styles.stationName}>{s.name}</span>
                            <span className={styles.stationMeta}>
                              {s.timeMinutes}分 ・ 乗換{s.transfers}回
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {status.stations.length > visibleCount && (
                      <button
                        type="button"
                        className={styles.moreButton}
                        onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                      >
                        もっと見る（残り {status.stations.length - visibleCount}
                        {" "}
                        駅）
                      </button>
                    )}
                  </>
                )}
            </div>
          )}
        </div>

        <div className={styles.mapPane}>
          <CommuteMap
            workplace={status.kind === "done" ? status.workplace : null}
            stations={status.kind === "done" ? status.stations : []}
            accessStations={status.kind === "done"
              ? status.accessStations
              : []}
            term={Number(term) || 30}
            focus={focus}
          />
        </div>
      </div>
    </section>
  );
}
