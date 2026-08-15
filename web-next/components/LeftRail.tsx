"use client";

import type { AccessStation, ReachableStation, StationWithLines } from "../lib/navitimeProxy";
import type { SearchStatus } from "../lib/searchState";
import type { RailwayLine } from "../lib/railwayCache";
import LineSelector from "./LineSelector";
import styles from "./LeftRail.module.css";

export type RailTab = "stations" | "lines" | "properties";

export interface LeftRailProps {
  status: SearchStatus;
  tab: RailTab;
  onTabChange: (tab: RailTab) => void;
  visibleCount: number;
  onShowMore: () => void;
  onFocusStation: (stationId: string) => void;
  lineGroups: StationWithLines[];
  selectedLine: RailwayLine | null;
  lineLoadingId: string | null;
  lineError: string | null;
  onSelectLine: (lineId: string, officialColor: string | null) => void;
  onClearLine: () => void;
  onRetry: () => void;
  onUseExample: () => void;
}

function PrimaryStationRow(
  { station, onFocus }: { station: AccessStation; onFocus: () => void },
) {
  return (
    <button
      type="button"
      className={`${styles.card} ${styles.primaryCard}`}
      onClick={onFocus}
    >
      <span className={styles.cardName}>{station.name}</span>
      <span className={styles.cardMeta}>
        徒歩{station.walkMinutes}分 ・ {station.walkDistance}m
      </span>
    </button>
  );
}

function CandidateRow(
  { station, onFocus }: { station: ReachableStation; onFocus: () => void },
) {
  return (
    <button type="button" className={styles.card} onClick={onFocus}>
      <span className={styles.cardName}>{station.name}</span>
      <span className={styles.cardMetrics}>
        <span className={styles.metric}>{station.timeMinutes}分</span>
        <span className={styles.cardMeta}>乗換{station.transfers}回</span>
      </span>
    </button>
  );
}

function Skeleton() {
  return (
    <div className={styles.skeletonList}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={styles.skeletonRow} />
      ))}
    </div>
  );
}

export default function LeftRail({
  status,
  tab,
  onTabChange,
  visibleCount,
  onShowMore,
  onFocusStation,
  lineGroups,
  selectedLine,
  lineLoadingId,
  lineError,
  onSelectLine,
  onClearLine,
  onRetry,
  onUseExample,
}: LeftRailProps) {
  const done = status.kind === "done" ? status : null;

  return (
    <aside className={styles.rail}>
      {done && (
        <div className={styles.summary}>
          <p className={styles.summaryLabel}>勤務先</p>
          <p className={styles.summaryName}>
            {done.workplace.name}
            {done.mock && <span className={styles.badge}>モックデータ</span>}
          </p>
          <p className={styles.summaryConditions}>
            {done.term}分以内 ・{" "}
            {done.transitLimit === null
              ? "乗換制限なし"
              : `乗換${done.transitLimit}回まで`} ・ {done.stations.length}駅
          </p>
        </div>
      )}

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stations"}
          className={`${styles.tab} ${tab === "stations" ? styles.tabActive : ""}`}
          onClick={() => onTabChange("stations")}
        >
          駅{done ? `（${done.stations.length}）` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "lines"}
          className={`${styles.tab} ${tab === "lines" ? styles.tabActive : ""}`}
          onClick={() => onTabChange("lines")}
        >
          路線
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "properties"}
          className={`${styles.tab} ${
            tab === "properties" ? styles.tabActive : ""
          }`}
          onClick={() => onTabChange("properties")}
        >
          物件
        </button>
      </div>

      <div className={styles.content}>
        {status.kind === "idle" && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>通える駅を探しましょう</p>
            <p className={styles.emptyBody}>
              勤務先の住所と通勤条件を入力すると、通勤圏内の駅を地図に表示します。
            </p>
            <button
              type="button"
              className={styles.secondary}
              onClick={onUseExample}
            >
              東京都千代田区丸の内1-9-1 を試す
            </button>
          </div>
        )}

        {status.kind === "loading" && <Skeleton />}

        {status.kind === "error" && (
          <div className={styles.errorState}>
            <p className={styles.errorTitle}>検索に失敗しました</p>
            <p className={styles.errorBody}>{status.message}</p>
            <button
              type="button"
              className={styles.secondary}
              onClick={onRetry}
            >
              再試行
            </button>
          </div>
        )}

        {status.kind === "no_address" && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>住所が見つかりませんでした</p>
            <p className={styles.emptyBody}>
              市区町村から番地までを含めた表記でお試しください。
            </p>
          </div>
        )}

        {done && tab === "stations" && (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>主要起点駅</h2>
              <p className={styles.sectionNote}>勤務先から徒歩15分以内・最大3駅</p>
              {done.accessStations.length === 0
                ? (
                  <p className={styles.note}>
                    徒歩15分以内の鉄道駅は見つかりませんでした。
                  </p>
                )
                : (
                  <div className={styles.list}>
                    {done.accessStations.map((s) => (
                      <PrimaryStationRow
                        key={`access-${s.id}`}
                        station={s}
                        onFocus={() => onFocusStation(s.id)}
                      />
                    ))}
                  </div>
                )}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>候補駅</h2>
              {done.stations.length === 0
                ? (
                  <p className={styles.note}>
                    条件に合う駅が見つかりませんでした。通勤時間や乗換回数の条件を緩めてみてください。
                  </p>
                )
                : (
                  <>
                    <p className={styles.sectionNote}>
                      通勤時間の短い順 ・ 上位{" "}
                      {Math.min(visibleCount, done.stations.length)} /{" "}
                      {done.stations.length} 駅
                    </p>
                    <div className={styles.list}>
                      {done.stations.slice(0, visibleCount).map((s) => (
                        <CandidateRow
                          key={s.id}
                          station={s}
                          onFocus={() => onFocusStation(s.id)}
                        />
                      ))}
                    </div>
                    {done.stations.length > visibleCount && (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={onShowMore}
                      >
                        もっと見る（残り {done.stations.length - visibleCount} 駅）
                      </button>
                    )}
                  </>
                )}
            </section>
          </>
        )}

        {done && tab === "lines" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>鉄道路線</h2>
            <p className={styles.sectionNote}>
              地図に表示できるのは 1 本だけです
            </p>
            <LineSelector
              groups={lineGroups}
              selectedLine={selectedLine}
              loadingLineId={lineLoadingId}
              error={lineError}
              onSelect={onSelectLine}
              onClear={onClearLine}
            />
          </section>
        )}

        {done && tab === "properties" && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>物件はこれから</p>
            <p className={styles.emptyBody}>
              地図の表示範囲から賃貸物件を読み込む機能は次の段階で追加します。
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
