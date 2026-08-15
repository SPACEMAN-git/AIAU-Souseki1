import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { sortListings } from '../lib/filters'
import { t, tf } from '../lib/i18n'
import {
  formatArea,
  formatDate,
  formatMinutes,
  formatYen,
} from '../lib/format'
import type { ListingWithCommute } from '../lib/types'

export function ListingList() {
  const { locale, results, sortKey, selectedListingId } = useAppStore()
  const sorted = sortListings(results, sortKey)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedListingId || !listRef.current) return
    const el = listRef.current.querySelector(
      `[data-listing-id="${selectedListingId}"]`,
    )
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedListingId])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm font-medium">
        {results.length > 0
          ? tf(locale, 'resultsCount', results.length)
          : t(locale, 'noResults')}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto bg-gray-50 p-2">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ListingCard({ listing }: { listing: ListingWithCommute }) {
  const {
    locale,
    selectedListingId,
    favorites,
    selectListing,
    hoverListing,
    openDetail,
    toggleFavorite,
  } = useAppStore()
  const selected = selectedListingId === listing.id
  const fav = favorites.includes(listing.id)
  return (
    <div
      data-listing-id={listing.id}
      className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md ${
        selected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'
      }`}
      onMouseEnter={() => hoverListing(listing.id)}
      onMouseLeave={() => hoverListing(null)}
      onClick={() => {
        selectListing(listing.id)
        openDetail(listing.id)
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{listing.title}</div>
          <div className="text-xs text-gray-500">
            {listing.address}
            {listing.isDemo && (
              <span className="ml-1 rounded bg-gray-200 px-1 text-[10px] text-gray-600">
                {t(locale, 'demoData')}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={`text-lg ${fav ? 'text-yellow-500' : 'text-gray-300'}`}
          onClick={(e) => {
            e.stopPropagation()
            toggleFavorite(listing.id)
          }}
          aria-label={t(locale, 'favorite')}
        >
          ★
        </button>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-lg font-bold text-indigo-700">
          {formatYen(listing.monthlyRent)}
        </span>
        <span className="text-xs text-gray-500">
          +{formatYen(listing.managementFee)} / {listing.layout} /{' '}
          {formatArea(listing.floorArea)} / 築{listing.buildingAge}年
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-600">
        {listing.nearestStationName}駅 徒歩{listing.walkMinutesToStation}分
      </div>
      {listing.commute && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
            {t(locale, 'commuteTime')} {formatMinutes(listing.commute.durationMinutes)}
          </span>
          <span className="text-gray-500">
            {t(locale, 'transfers')}{listing.commute.transferCount}回
          </span>
          {listing.commute.estimatedCostYen != null && (
            <span className="text-gray-500">
              {formatYen(listing.commute.estimatedCostYen)}
            </span>
          )}
          {listing.commute.isEstimated && (
            <span className="rounded bg-amber-100 px-1 text-amber-700">
              {t(locale, 'estimated')}
            </span>
          )}
        </div>
      )}
      <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
        <span>
          {t(locale, 'score')}:{' '}
          <span className="font-semibold text-gray-700">
            {listing.score ?? '—'}
          </span>
        </span>
        <span>
          {t(locale, 'updatedAt')} {formatDate(listing.updatedAt, locale)}
        </span>
      </div>
    </div>
  )
}
