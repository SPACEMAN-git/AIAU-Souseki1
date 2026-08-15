import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { t } from '../lib/i18n'
import {
  formatArea,
  formatDate,
  formatMinutes,
  formatYen,
} from '../lib/format'
import type { RouteLeg } from '../lib/types'

const LEG_ICON: Record<RouteLeg['kind'], string> = {
  walk: '🚶',
  train: '🚃',
  bus: '🚌',
  car: '🚗',
  bicycle: '🚲',
  wait: '⏳',
  transfer: '🔁',
}

export function ListingDetail() {
  const {
    locale,
    results,
    detailListingId,
    openDetail,
    favorites,
    toggleFavorite,
    compareIds,
    toggleCompare,
  } = useAppStore()

  useEffect(() => {
    if (!detailListingId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') openDetail(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [detailListingId, openDetail])

  const listing = results.find((l) => l.id === detailListingId)
  if (!listing) return null
  const fav = favorites.includes(listing.id)
  const monthlyCommuteCost =
    listing.commute?.estimatedCostYen != null
      ? listing.commute.estimatedCostYen * 2 * 20
      : null
  const totalMonthly =
    listing.monthlyRent +
    listing.managementFee +
    (monthlyCommuteCost ?? 0)

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold">{listing.title}</h2>
          <p className="truncate text-xs text-gray-500">{listing.address}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          onClick={() => openDetail(null)}
        >
          ✕ {t(locale, 'close')}
        </button>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-200 bg-indigo-50/60 px-4 py-3">
        <span className="text-2xl font-bold text-indigo-700">
          {formatYen(listing.monthlyRent)}
        </span>
        <span className="text-xs text-gray-600">
          +{formatYen(listing.managementFee)}
        </span>
        <span className="text-sm text-gray-700">
          {listing.layout}・{formatArea(listing.floorArea)}・築
          {listing.buildingAge}年
        </span>
        {listing.commute && (
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
            {t(locale, 'commuteTime')}{' '}
            {formatMinutes(listing.commute.durationMinutes)}
          </span>
        )}
        {listing.score != null && (
          <span className="rounded bg-white px-2 py-0.5 text-xs text-gray-700 ring-1 ring-gray-200">
            {t(locale, 'score')} {listing.score}/100
          </span>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {listing.isDemo && (
          <div className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-600">
            {t(locale, 'demoData')} — {listing.sourceName}
          </div>
        )}
        <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
          {listing.imageUrls.length > 0 ? (
            <img
              src={listing.imageUrls[0]}
              alt={listing.title}
              className="h-full w-full rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            'No Image'
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Info label={t(locale, 'deposit')} value={formatYen(listing.deposit)} />
          <Info label={t(locale, 'keyMoney')} value={formatYen(listing.keyMoney)} />
          <Info label={t(locale, 'layout')} value={listing.layout} />
          <Info label={t(locale, 'area')} value={formatArea(listing.floorArea)} />
          <Info
            label={t(locale, 'buildingAge')}
            value={`築${listing.buildingAge}年（${listing.builtYear}年）`}
          />
          <Info
            label={t(locale, 'stationWalk')}
            value={`${listing.nearestStationName} 徒歩${listing.walkMinutesToStation}分`}
          />
          <Info
            label="階"
            value={`${listing.floorNumber}F / ${listing.totalFloors}F・${listing.structureType}`}
          />
        </div>
        <div>
          <div className="text-xs text-gray-500">住所</div>
          <div>{listing.address}</div>
          <div className="mt-1 text-xs text-gray-500">
            {listing.nearestStationName}駅（{listing.railwayLine}）徒歩
            {listing.walkMinutesToStation}分
          </div>
        </div>
        {listing.commute && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              {t(locale, 'commuteTime')}:{' '}
              {formatMinutes(listing.commute.durationMinutes)}
              {listing.commute.isEstimated && (
                <span className="rounded bg-amber-100 px-1 text-xs text-amber-700">
                  {t(locale, 'estimated')}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-600">
              {t(locale, 'routeSummary')}: {listing.commute.summary}
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
              {listing.commute.legs.map((leg, i) => (
                <li key={i}>
                  {LEG_ICON[leg.kind] ?? '·'} {leg.lineName ?? ''}{' '}
                  {formatMinutes(leg.minutes)}
                  {(leg.fromName || leg.toName) && (
                    <span className="text-gray-500">
                      （{leg.fromName ?? '?'} → {leg.toName ?? '?'}）
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-1 text-xs text-gray-500">
              {t(locale, 'transfers')}: {listing.commute.transferCount}回 /{' '}
              {t(locale, 'fare')}: {formatYen(listing.commute.estimatedCostYen)}
              <br />
              {t(locale, 'dataSource')}: {listing.commute.provider}（
              {formatDate(listing.commute.computedAt, locale)}）
            </div>
            {listing.commute.isEstimated && (
              <div className="mt-1 text-xs text-amber-700">
                {t(locale, 'demoModeNotice')}
              </div>
            )}
            <a
              className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
              href="https://www.navitime.co.jp/transfer/"
              target="_blank"
              rel="noreferrer"
            >
              NAVITIMEでルートを確認 ↗
            </a>
          </div>
        )}
        {monthlyCommuteCost != null && (
          <div className="rounded-lg bg-gray-50 p-3 text-xs">
            {t(locale, 'totalMonthlyCost')}:{' '}
            <span className="font-bold">{formatYen(totalMonthly)}</span>
            <span className="text-gray-500">
              （{t(locale, 'rent')}+{t(locale, 'managementFee')}+通勤
              {formatYen(monthlyCommuteCost)}/月・20日往復{t(locale, 'estimated')}）
            </span>
          </div>
        )}
        {listing.score != null && (
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs font-semibold text-gray-700">
              {t(locale, 'score')}: {listing.score}/100
            </div>
            {listing.scoreReasons && listing.scoreReasons.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-gray-600">
                {listing.scoreReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {(
            [
              'petsAllowed',
              'furnished',
              'bathToiletSeparate',
              'autoLock',
              'deliveryBox',
              'parkingAvailable',
              'bicycleParking',
              'internetFree',
            ] as const
          )
            .filter((k) => listing[k])
            .map((k) => (
              <span
                key={k}
                className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
              >
                {t(locale, k)}
              </span>
            ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              fav
                ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => toggleFavorite(listing.id)}
          >
            ★ {t(locale, 'favorite')}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              compareIds.includes(listing.id)
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => toggleCompare(listing.id)}
          >
            ⇄ {t(locale, 'compare')}
          </button>
        </div>
        <div className="text-xs text-gray-400">
          {t(locale, 'favoritesLocalNotice')}
          <br />
          {t(locale, 'updatedAt')}: {formatDate(listing.updatedAt, locale)}
        </div>
      </div>
    </aside>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div>{value}</div>
    </div>
  )
}
