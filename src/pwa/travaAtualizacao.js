const motivos = new Set()
const ouvintes = new Set()
const notificar = (antes) => {
  const agora = motivos.size > 0
  if (agora !== antes) ouvintes.forEach((cb) => cb(agora))
}
export function travar(motivo) { const antes = motivos.size > 0; motivos.add(motivo); notificar(antes) }
export function liberar(motivo) { const antes = motivos.size > 0; motivos.delete(motivo); notificar(antes) }
export function estaTravado() { return motivos.size > 0 }
export function aoMudarTrava(cb) { ouvintes.add(cb); return () => { ouvintes.delete(cb) } }
