import { useAppStore } from '../store/appStore'
import { t } from '../lib/i18n'
import { formatArea, formatMinutes, formatYen } from '../lib/format'

export function CompareDrawer() {
  const { locale, results, compareIds, toggleCompare } = useAppStore()
  const items = results.filter((l) => compareIds.includes(l.id))
  if (items.length < 2) return null

  const rows: Array<[string, (l: (typeof items)[number]) => string]> = [
    [t(locale, 'rent'), (l) => formatYen(l.monthlyRent)],
    [t(locale, 'managementFee'), (l) => formatYen(l.managementFee)],
    [
      '初期費用',
      (l) => formatYen(l.deposit + l.keyMoney + l.monthlyRent),
    ],
    [t(locale, 'area'), (l) => formatArea(l.floorArea)],
    [t(locale, 'layout'), (l) => l.layout],
    [t(locale, 'buildingAge'), (l) => `築${l.buildingAge}年`],
    [t(locale, 'stationWalk'), (l) => `${l.walkMinutesToStation}分`],
    [
      t(locale, 'commuteTime'),
      (l) =>
        l.commute ? formatMinutes(l.commute.durationMinutes) : '—',
    ],
    [
      t(locale, 'transfers'),
      (l) => (l.commute ? `${l.commute.transferCount}回` : '—'),
    ],
    [
      t(locale, 'fare'),
      (l) => formatYen(l.commute?.estimatedCostYen ?? null),
    ],
    [t(locale, 'score'), (l) => String(l.score ?? '—')],
  ]

  return (
    <div className="absolute bottom-0 left-0 z-40 max-h-[50%] w-full overflow-auto border-t border-gray-300 bg-white shadow-2xl">
      <div className="sticky top-0 flex items-center justify-between bg-gray-50 px-4 py-2 text-sm font-semibold">
        {t(locale, 'compare')}（{items.length}）
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="w-28 p-2 text-left text-gray-500"></th>
            {items.map((l) => (
              <th key={l.id} className="p-2 text-left">
                {l.title}
                <button
                  type="button"
                  className="ml-1 text-gray-400 hover:text-red-500"
                  onClick={() => toggleCompare(l.id)}
                >
                  ✕
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, fn]) => (
            <tr key={label} className="border-t border-gray-100">
              <td className="p-2 text-gray-500">{label}</td>
              {items.map((l) => (
                <td key={l.id} className="p-2">
                  {fn(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
