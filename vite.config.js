import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const frontendPort = Number(env.VITE_PORT || 5173)
  const apiPort = Number(env.API_PORT || 3001)
  const proxyTarget = env.VITE_API_PROXY_TARGET || `http://localhost:${apiPort}`

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
