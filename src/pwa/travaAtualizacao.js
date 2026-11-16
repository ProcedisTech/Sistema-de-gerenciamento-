const motivos = new Set()
const ouvintes = new Set()
const ouvintesMotivos = new Set()
const notificar = (antes, mudou) => {
  if (mudou) ouvintesMotivos.forEach((cb) => cb())
  const agora = motivos.size > 0
  if (agora !== antes) ouvintes.forEach((cb) => cb(agora))
}
export function travar(motivo) { const antes = motivos.size > 0; const n = motivos.size; motivos.add(motivo); notificar(antes, motivos.size !== n) }
export function liberar(motivo) { const antes = motivos.size > 0; const apagou = motivos.delete(motivo); notificar(antes, apagou) }
export function estaTravado() { return motivos.size > 0 }
export function aoMudarTrava(cb) { ouvintes.add(cb); return () => { ouvintes.delete(cb) } }

export function travadoPor(motivo) { return motivos.has(motivo) }
export function travadoAlemDe(motivo) { return [...motivos].some((m) => m !== motivo) }
export function aoMudarMotivos(cb) { ouvintesMotivos.add(cb); return () => { ouvintesMotivos.delete(cb) } }

export const CONSULTA_ENTRE_ABAS = 'procedi-consulta-na-tela'

// Segura o lock compartilhado só enquanto a aba está visível (escondida = segundo plano).
export function segurarEntreAbas(nome) {
  if (typeof navigator === 'undefined' || !navigator.locks) return () => {}
  let soltarLock = null
  const segurar = () => {
    if (soltarLock) return
    const p = new Promise((res) => { soltarLock = () => { soltarLock = null; res() } })
    navigator.locks.request(nome, { mode: 'shared' }, () => p).catch(() => {})
  }
  const aoMudarVisibilidade = () => (document.visibilityState === 'visible' ? segurar() : soltarLock?.())
  document.addEventListener('visibilitychange', aoMudarVisibilidade)
  aoMudarVisibilidade()
  return () => {
    document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    soltarLock?.()
  }
}

export async function seguradoEmOutraAba(nome) {
  if (typeof navigator === 'undefined' || !navigator.locks?.query) return false
  try {
    const { held = [] } = await navigator.locks.query()
    return held.some((l) => l.name === nome)
  } catch { return false }
}

// Resolve quando nenhuma outra aba segura o lock; sem API, na hora.
export function esperarOutraAba(nome) {
  if (typeof navigator === 'undefined' || !navigator.locks) return Promise.resolve()
  return navigator.locks.request(nome, { mode: 'exclusive' }, () => {}).catch(() => {})
}
