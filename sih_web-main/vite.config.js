import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.cjs'  
  },
  server: {
    port: 5173, // Vite's default port
    host: true, // This allows access from network
    proxy: {
      '/api': {
        target: 'http://192.168.1.103:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})