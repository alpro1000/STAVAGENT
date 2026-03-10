import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: 10000,
    allowedHosts: [
      'stavagent-backend.vercel.app',
      'www.stavagent.cz',
      '.run.app'
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://concrete-agent-3uxelthc4q-ey.a.run.app',
        changeOrigin: true,
      }
    }
  }
})
