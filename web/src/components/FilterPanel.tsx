import { useAppStore } from '../store/appStore'
import { t } from '../lib/i18n'
import type { SortKey } from '../lib/types'

const LAYOUTS = ['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3LDK']
const SORT_KEYS: SortKey[] = [
  'recommended',
  'commute',
  'rent_asc',
  'area_desc',
  'station_walk',
  'newest_building',
  'initial_cost',
  'updated',
]
const AMENITY_KEYS = [
  'petsAllowed',
  'furnished',
  'bathToiletSeparate',
  'autoLock',
  'deliveryBox',
  'parkingAvailable',
  'bicycleParking',
  'internetFree',
] as const

export function FilterPanel() {
  const { locale, filters, setFilters, sortKey, setSortKey, resetFilters } =
    useAppStore()

  const num = (v: string) => (v === '' ? undefined : Number(v))

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-white p-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t(locale, 'filters')}</h2>
        <button
          type="button"
          className="text-xs text-indigo-600 hover:underline"
          onClick={resetFilters}
        >
          ↺
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          {t(locale, 'sort')}
        </label>
        <select
          className="w-full rounded border border-gray-300 px-2 py-1.5"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(locale, `sort_${k}` as 'sort_recommended')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          {t(locale, 'rent')}（円/月）
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step={5000}
            placeholder={t(locale, 'minRent')}
            className="w-full rounded border border-gray-300 px-2 py-1"
            value={filters.minRent ?? ''}
            onChange={(e) => setFilters({ minRent: num(e.target.value) })}
          />
          <span>–</span>
          <input
            type="number"
            step={5000}
            placeholder={t(locale, 'maxRent')}
            className="w-full rounded border border-gray-300 px-2 py-1"
            value={filters.maxRent ?? ''}
            onChange={(e) => setFilters({ maxRent: num(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          {t(locale, 'area')}（m²）
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-full rounded border border-gray-300 px-2 py-1"
            value={filters.minArea ?? ''}
            onChange={(e) => setFilters({ minArea: num(e.target.value) })}
          />
          <span>–</span>
          <input
            type="number"
            className="w-full rounded border border-gray-300 px-2 py-1"
            value={filters.maxArea ?? ''}
            onChange={(e) => setFilters({ maxArea: num(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          {t(locale, 'layout')}
        </label>
        <div className="flex flex-wrap gap-1">
          {LAYOUTS.map((l) => {
            const active = filters.layouts?.includes(l) ?? false
            return (
              <button
                key={l}
                type="button"
                className={`rounded border px-2 py-0.5 text-xs ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => {
                  const cur = filters.layouts ?? []
                  setFilters({
                    layouts: active
                      ? cur.filter((x) => x !== l)
                      : [...cur, l],
                  })
                }}
              >
                {l}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          {t(locale, 'buildingAge')}（年以内）
        </label>
        <input
          type="number"
          className="w-full rounded border border-gray-300 px-2 py-1"
          value={filters.maxBuildingAge ?? ''}
          onChange={(e) => setFilters({ maxBuildingAge: num(e.target.value) })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          {t(locale, 'stationWalk')}（分以内）
        </label>
        <input
          type="number"
          className="w-full rounded border border-gray-300 px-2 py-1"
          value={filters.maxStationWalk ?? ''}
          onChange={(e) => setFilters({ maxStationWalk: num(e.target.value) })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">
          {t(locale, 'amenities')}
        </label>
        <div className="flex flex-col gap-1">
          {AMENITY_KEYS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters[k] === true}
                onChange={(e) =>
                  setFilters({ [k]: e.target.checked ? true : undefined })
                }
              />
              {t(locale, k)}
            </label>
          ))}
        </div>
      </div>
    </aside>
  )
}
