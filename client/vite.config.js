import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    allowedHosts: ['5ba18249acdf.ngrok-free.app'],
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
})
