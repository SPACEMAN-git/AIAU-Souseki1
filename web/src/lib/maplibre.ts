import { setWorkerUrl } from 'maplibre-gl'
// maplibre-gl resolves its worker via `import.meta.url`, which 404s after
// bundling, so the worker is bundled explicitly and registered below.
// Importing the worker file itself (rather than a re-exporting entry module)
// keeps its side effects from being tree-shaken away.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

let done = false

/** Point maplibre-gl at the bundled worker chunk. Must run before any Map. */
export function setupMaplibre() {
  if (done) return
  done = true
  setWorkerUrl(workerUrl)
}
