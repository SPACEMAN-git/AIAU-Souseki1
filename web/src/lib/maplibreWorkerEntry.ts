// MapLibre worker entry bundled by Vite.
// maplibre-gl resolves its worker via `import.meta.url`, which does not exist
// after bundling, so the worker is registered explicitly (see setupMaplibre).
import 'maplibre-gl/dist/maplibre-gl-worker.mjs'
