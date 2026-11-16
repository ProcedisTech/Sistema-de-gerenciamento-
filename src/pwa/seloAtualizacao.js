let selo = null
const ouvintes = new Set()
export function definirSelo(fn) { selo = fn; ouvintes.forEach((cb) => cb()) }
export function lerSelo() { return selo }
export function aoMudarSelo(cb) { ouvintes.add(cb); return () => { ouvintes.delete(cb) } }
