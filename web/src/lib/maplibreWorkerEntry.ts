// MapLibre worker entry bundled by Vite (see setupMaplibre).
// The namespace is assigned to `self` because maplibre-gl declares its dist
// files side-effect free, so a bare import would be tree-shaken away and the
// worker chunk would end up empty.
import * as worker from 'maplibre-gl/dist/maplibre-gl-worker.mjs'

;(self as unknown as { __maplibreWorker?: unknown }).__maplibreWorker = worker
