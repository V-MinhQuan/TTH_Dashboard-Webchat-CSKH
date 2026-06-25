import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  base: './',

  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],

  optimizeDeps: {
    include: [
      'recharts',
      'lodash/get',
      'lodash/isNil',
      'lodash/isString',
      'lodash/isFunction',
      'lodash/isObject',
      'lodash/isEqual',
      'lodash/sortBy',
      'lodash/throttle',
    ],
    exclude: ['exceljs', 'html2canvas', 'jspdf', 'lucide-react'],
  },

  build: {
    // Tăng nhẹ ngưỡng cảnh báo để tránh cảnh báo cho chunk recharts (thư viện lớn không thể tách nhỏ hơn)
    // Không đặt quá cao để vẫn phát hiện được bundle bất thường
    chunkSizeWarningLimit: 600,

  },
})
