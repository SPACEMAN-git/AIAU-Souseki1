"use client";

import styles from "./SearchBar.module.css";

const TERM_OPTIONS = [15, 20, 30, 45, 60, 90];
const TRANSIT_OPTIONS = [
  { value: "", label: "制限なし" },
  { value: "0", label: "乗換なし" },
  { value: "1", label: "1回まで" },
  { value: "2", label: "2回まで" },
  { value: "3", label: "3回まで" },
];

export interface SearchBarProps {
  address: string;
  term: string;
  transitLimit: string;
  loading: boolean;
  /** 入力値の検証エラー。該当フィールドの下にインライン表示する */
  validation: { field: "address" | "term" | "transitLimit"; message: string } |
    null;
  onAddressChange: (value: string) => void;
  onTermChange: (value: string) => void;
  onTransitLimitChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SearchBar({
  address,
  term,
  transitLimit,
  loading,
  validation,
  onAddressChange,
  onTermChange,
  onTransitLimitChange,
  onSubmit,
}: SearchBarProps) {
  return (
    <form className={styles.bar} onSubmit={onSubmit} noValidate>
      <label className={`${styles.field} ${styles.addressField}`}>
        <span className={styles.label}>勤務先</span>
        <input
          type="text"
          className={styles.input}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="例：東京都千代田区丸の内1-9-1"
          aria-invalid={validation?.field === "address"}
        />
        {validation?.field === "address" && (
          <span className={styles.inlineError}>{validation.message}</span>
        )}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>通勤時間</span>
        <select
          className={styles.input}
          value={term}
          onChange={(e) => onTermChange(e.target.value)}
        >
          {TERM_OPTIONS.map((t) => (
            <option key={t} value={String(t)}>{t}分以内</option>
          ))}
        </select>
        {validation?.field === "term" && (
          <span className={styles.inlineError}>{validation.message}</span>
        )}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>乗換</span>
        <select
          className={styles.input}
          value={transitLimit}
          onChange={(e) => onTransitLimitChange(e.target.value)}
        >
          {TRANSIT_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>{o.label}</option>
          ))}
        </select>
        {validation?.field === "transitLimit" && (
          <span className={styles.inlineError}>{validation.message}</span>
        )}
      </label>

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading && <span className={styles.spinner} aria-hidden />}
        {loading ? "検索中" : "検索"}
      </button>
    </form>
  );
}
