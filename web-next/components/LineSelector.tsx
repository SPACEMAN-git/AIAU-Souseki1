"use client";

import { useState } from "react";
import type { StationLine, StationWithLines } from "../lib/navitimeProxy";
import type { RailwayLine } from "../lib/railwayCache";
import { FALLBACK_LINE_COLOR } from "../lib/railwayCache";
import styles from "./LineSelector.module.css";

/** 駅ごとに既定で見せる路線数。残りは「その他の路線」に畳む */
const DEFAULT_VISIBLE = 3;

export interface LineSelectorProps {
  groups: StationWithLines[];
  selectedLine: RailwayLine | null;
  loadingLineId: string | null;
  error: string | null;
  onSelect: (lineId: string, officialColor: string | null) => void;
  onClear: () => void;
}

// 通勤で使う在来線・地下鉄を優先し、新幹線は後ろへ回す（表示順のみの調整）
function commuteRank(line: StationLine): number {
  return line.lineName.includes("新幹線") ? 1 : 0;
}

function sortForDisplay(lines: StationLine[]): StationLine[] {
  return [...lines].sort((a, b) => commuteRank(a) - commuteRank(b));
}

function LineChip({
  line,
  selected,
  loading,
  disabled,
  onSelect,
}: {
  line: StationLine;
  selected: boolean;
  loading: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const color = line.color ?? FALLBACK_LINE_COLOR;
  return (
    <button
      type="button"
      className={`${styles.chip} ${selected ? styles.chipSelected : ""}`}
      style={selected
        ? { borderColor: color, background: `${color}1f`, color: "var(--text-1)" }
        : undefined}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className={styles.swatch} style={{ background: color }} />
      <span className={styles.chipName}>{line.lineName}</span>
      {loading && <span className={styles.chipSpinner} aria-hidden />}
    </button>
  );
}

function StationLines({
  group,
  selectedLine,
  loadingLineId,
  onSelect,
}: {
  group: StationWithLines;
  selectedLine: RailwayLine | null;
  loadingLineId: string | null;
  onSelect: LineSelectorProps["onSelect"];
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = sortForDisplay(group.lines);
  const selectedIndex = lines.findIndex(
    (l) => l.lineId === selectedLine?.lineId,
  );
  // 折りたたみ中でも、選択中の路線は必ず見えるようにする
  const visible = expanded || selectedIndex >= DEFAULT_VISIBLE
    ? lines
    : lines.slice(0, DEFAULT_VISIBLE);
  const hidden = lines.length - visible.length;

  return (
    <div className={styles.group}>
      <p className={styles.stationName}>{group.stationName}</p>
      <div className={styles.chips}>
        {visible.map((line) => (
          <LineChip
            key={`${group.stationId}-${line.lineId}`}
            line={line}
            selected={selectedLine?.lineId === line.lineId}
            loading={loadingLineId === line.lineId}
            disabled={loadingLineId !== null &&
              loadingLineId !== line.lineId}
            onSelect={() => onSelect(line.lineId, line.color)}
          />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            className={styles.moreChip}
            onClick={() => setExpanded(true)}
          >
            その他の路線（+{hidden}）
          </button>
        )}
        {expanded && lines.length > DEFAULT_VISIBLE && (
          <button
            type="button"
            className={styles.moreChip}
            onClick={() => setExpanded(false)}
          >
            閉じる
          </button>
        )}
      </div>
    </div>
  );
}

export default function LineSelector({
  groups,
  selectedLine,
  loadingLineId,
  error,
  onSelect,
  onClear,
}: LineSelectorProps) {
  if (groups.length === 0) {
    return (
      <p className={styles.empty}>
        主要起点駅が確定すると、利用できる鉄道路線を選べます。
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.current}>
        {selectedLine
          ? (
            <>
              <span
                className={styles.currentSwatch}
                style={{ background: selectedLine.color }}
              />
              <span className={styles.currentName}>
                {selectedLine.lineName}
              </span>
              {selectedLine.operator && (
                <span className={styles.currentOperator}>
                  {selectedLine.operator}
                </span>
              )}
              <button
                type="button"
                className={styles.clear}
                onClick={onClear}
              >
                表示を解除
              </button>
            </>
          )
          : <span className={styles.currentNone}>路線は未選択（1 本だけ表示できます）</span>}
      </div>

      {groups.map((group) => (
        <StationLines
          key={`lines-${group.stationId}`}
          group={group}
          selectedLine={selectedLine}
          loadingLineId={loadingLineId}
          onSelect={onSelect}
        />
      ))}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
