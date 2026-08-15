import { useCallback, useEffect, useRef } from 'react'
import { SearchBar } from './components/SearchBar'
import { FilterPanel } from './components/FilterPanel'
import { MapView } from './components/MapView'
import { ListingList } from './components/ListingList'
import { ListingDetail } from './components/ListingDetail'
import { CompareDrawer } from './components/CompareDrawer'
import { DebugPanel } from './components/DebugPanel'
import { useAppStore } from './store/appStore'
import { runCommuteSearch } from './lib/search'
import { t } from './lib/i18n'
import { syncStateToUrl, restoreStateFromUrl } from './lib/urlState'

export default function App() {
  const store = useAppStore()
  const {
    locale,
    company,
    conditions,
    filters,
    searching,
    searchError,
    fallbackNotice,
  } = store
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    restoreStateFromUrl()
  }, [])

  const doSearch = useCallback(async () => {
    const { company, conditions, filters } = useAppStore.getState()
    if (!company) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const s = useAppStore.getState()
    s.setSearching(true)
    s.setSearchError(null)
    s.setFallbackNotice(false)
    try {
      const out = await runCommuteSearch(
        company,
        conditions,
        filters,
        undefined,
        controller.signal,
      )
      if (controller.signal.aborted) return
      const st = useAppStore.getState()
      st.setResults(out.results)
      st.setIsochrone(out.isochrone)
      st.setFallbackNotice(out.fallbackUsed)
      st.setDebug(out.debug)
      syncStateToUrl()
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return
      useAppStore
        .getState()
        .setSearchError(
          locale === 'ja'
            ? '検索中にエラーが発生しました。しばらくしてから再度お試しください。'
            : '搜索时发生错误，请稍后重试。',
        )
      console.error(err)
    } finally {
      if (!controller.signal.aborted) {
        useAppStore.getState().setSearching(false)
      }
    }
  }, [locale])

  // Re-run search (debounced) when filters/conditions change after a search.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!company) return
    const timer = setTimeout(doSearch, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, conditions])

  return (
    <div className="flex h-full flex-col">
      <SearchBar onSearch={doSearch} />
      {fallbackNotice && (
        <div className="bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          ⚠ {t(locale, 'fallbackNotice')}
        </div>
      )}
      {searchError && (
        <div className="bg-red-50 px-4 py-1.5 text-xs text-red-700">
          {searchError}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:block">
          <FilterPanel />
        </div>
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-[3]">
            <MapView />
            {searching && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40">
                <span className="rounded-lg bg-white px-4 py-2 text-sm shadow">
                  {t(locale, 'loading')}
                </span>
              </div>
            )}
            <CompareDrawer />
            <DebugPanel />
          </div>
          <div className="min-h-0 flex-[2] border-t border-gray-200">
            <ListingList />
          </div>
          <ListingDetail />
        </main>
      </div>
    </div>
  )
}
