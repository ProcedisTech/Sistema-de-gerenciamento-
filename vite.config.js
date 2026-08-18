import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const frontendPort = Number(env.VITE_PORT || process.env.PORT || 5173)
  const apiPort = Number(env.API_PORT || 8080)
  const proxyTarget = env.VITE_API_PROXY_TARGET || `http://localhost:${apiPort}`

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      strictPort: true,
      proxy: {
        // Spring em :8080; no browser a origem é :5173, então o cookie HttpOnly `jwt` segue same-origin via /api/*.
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: { '*': '' },
          cookiePathRewrite: { '*': '/' },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.headers.cookie) {
                proxyReq.setHeader('Cookie', req.headers.cookie);
              }
            });
          },
        },
      },
    },
    test: {
      // Ambiente DOM para testes de componente React
      environment: 'jsdom',
      // Injeta globals (describe, it, expect, vi) automaticamente — sem imports manuais
      globals: true,
      // Arquivo de setup para @testing-library/jest-dom matchers
      setupFiles: ['./src/test/setup.js'],
      // Glob de arquivos de teste
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      // Cobertura via V8 (nativa, mais rápida)
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/components/journey/lgpd/**'],
      },
      // Permite imports de CSS sem processar
      css: false,
    },
  }
})
