import { useRef, useState } from 'react'
import type { PlaceCandidate, TravelMode } from '../lib/types'
import { useAppStore } from '../store/appStore'
import { t } from '../lib/i18n'
import { MAX_COMMUTE_OPTIONS } from '../lib/config'
import { withFallback } from '../providers'

const MODES: TravelMode[] = ['transit', 'walk_transit', 'car', 'bicycle', 'walk']

export function SearchBar({ onSearch }: { onSearch: () => void }) {
  const {
    locale,
    company,
    conditions,
    setCompany,
    setConditions,
    setMapPickMode,
    searching,
    setLocale,
  } = useAppStore()
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleInput = (v: string) => {
    setQuery(v)
    clearTimeout(debounceRef.current)
    if (v.trim().length < 1) {
      setCandidates([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await withFallback(conditions.mode, (p) =>
          p.geocodePlace(v),
        )
        setCandidates(res)
        setOpen(true)
      } catch {
        setCandidates([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  const pick = (c: PlaceCandidate) => {
    setCompany(c)
    setQuery(c.name)
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
      <span className="text-lg font-bold text-indigo-700">
        {t(locale, 'appTitle')}
      </span>
      <div className="relative min-w-64 flex-1">
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder={t(locale, 'searchPlaceholder')}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => candidates.length > 0 && setOpen(true)}
        />
        {loading && (
          <span className="absolute top-2.5 right-3 text-xs text-gray-400">
            …
          </span>
        )}
        {open && candidates.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-indigo-50"
                  onClick={() => pick(c)}
                >
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-gray-500">
                    {c.address}・{c.placeType}・{c.prefecture}（
                    {c.lat.toFixed(4)}, {c.lng.toFixed(4)}）[{c.provider}]
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-600 hover:bg-gray-50"
        onClick={() => setMapPickMode(true)}
        title={t(locale, 'selectOnMap')}
      >
        📍 {t(locale, 'selectOnMap')}
      </button>
      <select
        className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
        value={conditions.mode}
        onChange={(e) => setConditions({ mode: e.target.value as TravelMode })}
        aria-label={t(locale, 'commuteMode')}
      >
        {MODES.map((m) => (
          <option key={m} value={m}>
            {t(locale, `mode_${m}` as 'mode_transit')}
          </option>
        ))}
      </select>
      <select
        className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
        value={conditions.maxMinutes}
        onChange={(e) => setConditions({ maxMinutes: Number(e.target.value) })}
        aria-label={t(locale, 'maxCommute')}
      >
        {MAX_COMMUTE_OPTIONS.map((m) => (
          <option key={m} value={m}>
            ≤ {m}分
          </option>
        ))}
      </select>
      <input
        type="time"
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        value={conditions.arrivalTime}
        onChange={(e) => setConditions({ arrivalTime: e.target.value })}
        aria-label={t(locale, 'arrivalTime')}
      />
      <button
        type="button"
        disabled={!company || searching}
        onClick={onSearch}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {searching ? t(locale, 'loading') : t(locale, 'searchButton')}
      </button>
      <button
        type="button"
        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
        onClick={() => setLocale(locale === 'ja' ? 'zh' : 'ja')}
      >
        {locale === 'ja' ? '中文' : '日本語'}
      </button>
    </div>
  )
}
