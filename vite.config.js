import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts')) return 'recharts'
          if (id.includes('@dnd-kit')) return 'dndkit'
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase'
        },
      },
    },
  },
})
