import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  define: {
    __WS_URL__: JSON.stringify(process.env.VITE_WS_URL ?? 'ws://localhost:3000/ws'),
    __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? 'http://localhost:3000/api'),
  },
})
