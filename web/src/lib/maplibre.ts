import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from './maplibreWorkerEntry?worker&url'

let done = false

/** Point maplibre-gl at the bundled worker chunk. Must run before any Map. */
export function setupMaplibre() {
  if (done) return
  done = true
  setWorkerUrl(workerUrl)
}
