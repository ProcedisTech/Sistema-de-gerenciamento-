import React from 'react'
import ReactDOM from 'react-dom/client'
import AppRoot from './components/AppRoot.jsx'
import './styles/index.css'

const rootEl = document.getElementById('root')

function renderFatalBootError(error) {
  const message = String(error?.message || error || 'Erro inesperado ao iniciar a aplicacao.')
  console.error('Falha ao inicializar o app:', error)

  if (!rootEl) return

  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fbfb;color:#0f172a;font-family:Arial,sans-serif;">
      <div style="width:100%;max-width:640px;background:#fff;border:3px solid #fecaca;border-radius:16px;padding:20px;box-shadow:0 10px 25px rgba(15,23,42,0.08);">
        <h1 style="margin:0 0 10px 0;color:#dc2626;font-size:24px;">Falha ao carregar o app</h1>
        <p style="margin:0 0 14px 0;color:#475569;font-size:14px;">Encontramos um erro de inicializacao. Recarregue a pagina e, se persistir, reinicie o servidor de desenvolvimento.</p>
        <pre style="margin:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-word;color:#334155;font-size:12px;">${message}</pre>
      </div>
    </div>
  `
}

window.addEventListener('error', (event) => {
  renderFatalBootError(event?.error || event?.message)
})

window.addEventListener('unhandledrejection', (event) => {
  renderFatalBootError(event?.reason)
})

try {
  if (!rootEl) {
    throw new Error('Elemento #root nao encontrado em index.html')
  }

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>,
  )
} catch (error) {
  renderFatalBootError(error)
}
