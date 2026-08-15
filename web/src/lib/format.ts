/** Formats yen as a compact Japanese-style string, e.g. 85000 -> "8.5万円". */
export function formatRentShort(yen: number): string {
  if (yen >= 10000) {
    const man = yen / 10000
    const s = Number.isInteger(man) ? String(man) : man.toFixed(1)
    return `${s}万円`
  }
  return `${yen.toLocaleString('ja-JP')}円`
}

export function formatYen(yen: number | null | undefined): string {
  if (yen == null) return '—'
  return `¥${yen.toLocaleString('ja-JP')}`
}

export function formatArea(sqm: number): string {
  return `${sqm.toFixed(1)}m²`
}

export function formatMinutes(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m === 0 ? `${h}時間` : `${h}時間${m}分`
  }
  return `${min}分`
}

export function formatDate(iso: string, locale: 'ja' | 'zh' = 'ja'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
