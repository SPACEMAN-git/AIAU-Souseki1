import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // maplibre-gl は worker を module worker として生成するため ES 形式で出力する。
  worker: { format: 'es' },
  server: {
    proxy: {
      // Geocoding.jp は CORS 非対応のため、開発時は dev サーバー経由で中継する。
      // 本番では Supabase Edge Function (geocode-place) を使用する。
      '/geocoding-api': {
        target: 'https://www.geocoding.jp',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/geocoding-api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
