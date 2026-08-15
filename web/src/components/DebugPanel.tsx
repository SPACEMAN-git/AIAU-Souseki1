import { useAppStore } from '../store/appStore'

export function DebugPanel() {
  const { debug, showDebug, toggleDebug } = useAppStore()
  if (!import.meta.env.DEV && !showDebug) return null
  return (
    <>
      <button
        type="button"
        className="absolute right-3 bottom-3 z-40 rounded bg-gray-800/80 px-2 py-1 text-xs text-white"
        onClick={toggleDebug}
      >
        🐞
      </button>
      {showDebug && debug && (
        <div className="absolute right-3 bottom-10 z-40 w-56 rounded-lg bg-gray-900/90 p-3 font-mono text-[11px] text-green-300 shadow-xl">
          <div>provider: {debug.provider}</div>
          <div>api calls: {debug.apiCalls}</div>
          <div>
            cache: {debug.cacheHits} hit / {debug.cacheMisses} miss
          </div>
          <div>phase: {debug.phase}</div>
          <div>prefilter: {debug.prefilterCount}</div>
          <div>isochrone: {debug.isochroneCount}</div>
          <div>verified: {debug.verifiedCount}</div>
          <div>final: {debug.finalCount}</div>
          <div>elapsed: {debug.elapsedMs}ms</div>
        </div>
      )}
    </>
  )
}
