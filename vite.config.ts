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
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Tăng nhẹ ngưỡng cảnh báo để tránh cảnh báo cho chunk recharts (thư viện lớn không thể tách nhỏ hơn)
    // Không đặt quá cao để vẫn phát hiện được bundle bất thường
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        /**
         * manualChunks — tách thư viện lớn thành các chunk riêng
         *
         * Nguyên tắc:
         *  - react-vendor: core React — thay đổi ít nhất, cache lâu nhất
         *  - charts: recharts, d3 — chỉ dùng trên trang analytics
         *  - icons: lucide-react — icon set lớn
         *  - mui: MUI + Emotion — component library nặng
         *  - router: react-router — routing layer
         *  - motion: framer motion — animation library
         *  - ui-utils: date-fns + utility libs nhỏ
         *  - radix: tất cả @radix-ui/* primitives
         *  - dnd: react-dnd (kéo thả) — load riêng
         *  - pdf: html2canvas, jspdf, dompurify
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          // PDF generation tools
          if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('dompurify')) {
            return 'pdf'
          }

          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor'
          }

          // Recharts + dependencies + d3
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'charts'
          }

          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons'
          }

          // MUI + Emotion (to lớn, tách riêng)
          if (
            id.includes('node_modules/@mui/') ||
            id.includes('node_modules/@emotion/')
          ) {
            return 'mui'
          }

          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'router'
          }

          // Motion (Framer Motion v12 đặt tên package là "motion")
          if (id.includes('node_modules/motion')) {
            return 'motion'
          }

          // DnD
          if (
            id.includes('node_modules/react-dnd') ||
            id.includes('node_modules/dnd-core') ||
            id.includes('node_modules/react-dnd-html5-backend')
          ) {
            return 'dnd'
          }

          // Utility libs nhỏ: date-fns, clsx, tailwind-merge, class-variance-authority, sonner, next-themes
          if (
            id.includes('node_modules/date-fns') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge') ||
            id.includes('node_modules/class-variance-authority') ||
            id.includes('node_modules/sonner') ||
            id.includes('node_modules/next-themes') ||
            id.includes('node_modules/tw-animate-css')
          ) {
            return 'ui-utils'
          }

          // Radix UI primitives — nhiều package nhỏ, gom vào một chunk
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix'
          }
          
          return 'vendor'
        },
      },
    },
  },
})
